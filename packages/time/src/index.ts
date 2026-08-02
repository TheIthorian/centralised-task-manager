import { ValidationError } from '@ctm/errors';

/** The zone every all-day date is read and written in, so it names one calendar day worldwide. */
export const UTC = 'UTC';

/** A calendar date with no instant attached, as `YYYY-MM-DD`. */
export type DateKey = string;

/** A wall-clock reading of an instant in some zone. */
export type ZonedParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MILLISECONDS_PER_DAY = 86_400_000;

// One formatter per zone: constructing an Intl.DateTimeFormat is the expensive part, and the
// reminder crons read the same handful of zones once per user per run.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Whether `timeZone` is an IANA identifier this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });

        return true;
    } catch {
        return false;
    }
}

/** Returns `timeZone` unchanged, or throws if it is not an IANA identifier. */
export function assertTimeZone(timeZone: string): string {
    if (!isValidTimeZone(timeZone)) throw new ValidationError(`Unknown time zone: ${timeZone}`);

    return timeZone;
}

/** The wall clock an instant reads as in `timeZone`. */
export function zonedParts({ instant, timeZone }: { instant: Date; timeZone: string }): ZonedParts {
    const parts = formatterFor(timeZone).formatToParts(instant);
    const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value);

    // `hourCycle: 'h23'` renders midnight as 24 in some ICU versions; normalise it back to 0.
    const hour = read('hour') % 24;

    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour,
        minute: read('minute'),
        second: read('second'),
    };
}

/** The calendar day an instant falls on in `timeZone`, as `YYYY-MM-DD`. */
export function toDateKey({ instant, timeZone }: { instant: Date; timeZone: string }): DateKey {
    const { year, month, day } = zonedParts({ instant, timeZone });

    return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Splits a `YYYY-MM-DD` key into its numbers. Throws if the key is malformed. */
export function parseDateKey(dateKey: DateKey): { year: number; month: number; day: number } {
    if (!DATE_KEY_PATTERN.test(dateKey)) throw new ValidationError(`Malformed date key: ${dateKey}`);

    const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];

    return { year, month, day };
}

/**
 * The instant a wall-clock time occurs at in `timeZone`.
 *
 * A wall-clock time is not always a single instant: the hour a zone skips forward does not exist,
 * and the hour it repeats happens twice. Solving the offset twice lands on the first of the two
 * candidates for a repeated hour, and on the same instant the hour would have been had it not been
 * skipped for a gap, which is the convention every calendar uses.
 */
export function instantFromWallClock({
    dateKey,
    hour = 0,
    minute = 0,
    timeZone,
}: {
    dateKey: DateKey;
    hour?: number;
    minute?: number;
    timeZone: string;
}): Date {
    const { year, month, day } = parseDateKey(dateKey);
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const firstOffset = offsetAt({ instant: new Date(asUtc), timeZone });
    const firstGuess = new Date(asUtc - firstOffset);
    const correctedOffset = offsetAt({ instant: firstGuess, timeZone });

    if (correctedOffset === firstOffset) return firstGuess;

    const corrected = new Date(asUtc - correctedOffset);

    return reads({ instant: corrected, timeZone, dateKey, hour, minute }) ? corrected : firstGuess;
}

/** Midnight in `timeZone` on the day `instant` falls on. */
export function startOfDay({ instant, timeZone }: { instant: Date; timeZone: string }): Date {
    return instantFromWallClock({ dateKey: toDateKey({ instant, timeZone }), timeZone });
}

/**
 * The same wall-clock time `days` later in `timeZone`.
 *
 * Adding 24 hours of milliseconds would drift by an hour across a DST boundary, which is how a
 * "tomorrow at 09:00" reminder ends up at 08:00 twice a year.
 */
export function addDays({ instant, days, timeZone }: { instant: Date; days: number; timeZone: string }): Date {
    const { year, month, day, hour, minute } = zonedParts({ instant, timeZone });
    const shifted = new Date(Date.UTC(year, month - 1, day + days));

    return instantFromWallClock({ dateKey: toDateKey({ instant: shifted, timeZone: UTC }), hour, minute, timeZone });
}

/** Midnight in `timeZone` on the Monday of the week `instant` falls in. */
export function startOfWeek({ instant, timeZone }: { instant: Date; timeZone: string }): Date {
    const weekday = dayOfWeek(toDateKey({ instant, timeZone }));
    const daysToMonday = weekday === 0 ? -6 : 1 - weekday;

    return startOfDay({ instant: addDays({ instant, days: daysToMonday, timeZone }), timeZone });
}

/** Midnight in `timeZone` on the Sunday that ends the week `instant` falls in. */
export function startOfLastDayOfWeek({ instant, timeZone }: { instant: Date; timeZone: string }): Date {
    const monday = startOfWeek({ instant, timeZone });

    return startOfDay({ instant: addDays({ instant: monday, days: 6, timeZone }), timeZone });
}

/**
 * Whole calendar days from `from` to `to` in `timeZone`, negative when `to` is earlier.
 *
 * Counted between date keys rather than instants, so a 23 or 25 hour DST day still counts as one.
 */
export function differenceInCalendarDays({
    from,
    to,
    timeZone,
}: {
    from: Date;
    to: Date;
    timeZone: string;
}): number {
    const fromUtc = utcMidnightOf(toDateKey({ instant: from, timeZone }));
    const toUtc = utcMidnightOf(toDateKey({ instant: to, timeZone }));

    return Math.round((toUtc - fromUtc) / MILLISECONDS_PER_DAY);
}

/** Day of the week for a date key, 0 for Sunday through 6 for Saturday. */
export function dayOfWeek(dateKey: DateKey): number {
    return new Date(utcMidnightOf(dateKey)).getUTCDay();
}

/** The hour of the day, 0 to 23, that `instant` reads as in `timeZone`. */
export function zonedHour({ instant, timeZone }: { instant: Date; timeZone: string }): number {
    return zonedParts({ instant, timeZone }).hour;
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
export function offsetAt({ instant, timeZone }: { instant: Date; timeZone: string }): number {
    const { year, month, day, hour, minute, second } = zonedParts({ instant, timeZone });
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second, instant.getUTCMilliseconds());

    return asUtc - instant.getTime();
}

function reads({
    instant,
    timeZone,
    dateKey,
    hour,
    minute,
}: {
    instant: Date;
    timeZone: string;
    dateKey: DateKey;
    hour: number;
    minute: number;
}): boolean {
    const parts = zonedParts({ instant, timeZone });

    return toDateKey({ instant, timeZone }) === dateKey && parts.hour === hour && parts.minute === minute;
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
    const cached = formatterCache.get(timeZone);

    if (cached) return cached;

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: assertTimeZone(timeZone),
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    formatterCache.set(timeZone, formatter);

    return formatter;
}

function utcMidnightOf(dateKey: DateKey): number {
    const { year, month, day } = parseDateKey(dateKey);

    return Date.UTC(year, month - 1, day);
}

function pad(value: number, width: number): string {
    return String(value).padStart(width, '0');
}
