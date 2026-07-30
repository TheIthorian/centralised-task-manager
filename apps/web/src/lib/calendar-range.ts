/** How much of the calendar is on screen at once. */
export type CalendarRange = 'month' | 'week' | 'threeDay' | 'day';

export const CALENDAR_RANGES: CalendarRange[] = ['month', 'week', 'threeDay', 'day'];

const DAYS_IN_RANGE: Record<Exclude<CalendarRange, 'month'>, number> = {
    week: 7,
    threeDay: 3,
    day: 1,
};

/** Local YYYY-MM-DD. Task due dates are compared as calendar days, not instants. */
export function toDateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

/** The days on screen, in order. A month starts at the 1st; shorter ranges start at the anchor. */
export function buildDays({ anchor, range }: { anchor: Date; range: CalendarRange }): Date[] {
    if (range === 'month') {
        const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

        return countFrom({ start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), count });
    }

    return countFrom({ start: startOfRange({ anchor, range }), count: DAYS_IN_RANGE[range] });
}

/**
 * Where the visible range begins. A week is pinned to its Sunday so the columns line up with
 * the month grid above it; a three day range floats, because its job is "today and what is
 * coming", not a fixed slice of the week.
 */
export function startOfRange({ anchor, range }: { anchor: Date; range: CalendarRange }): Date {
    if (range === 'month') return new Date(anchor.getFullYear(), anchor.getMonth(), 1);

    if (range !== 'week') return startOfDay(anchor);

    const sunday = startOfDay(anchor);
    sunday.setDate(sunday.getDate() - sunday.getDay());

    return sunday;
}

/** Moves the anchor one whole range forward or back, so paging never overlaps or skips days. */
export function shiftAnchor({
    anchor,
    range,
    direction,
}: {
    anchor: Date;
    range: CalendarRange;
    direction: 1 | -1;
}): Date {
    if (range === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);

    const next = startOfRange({ anchor, range });
    next.setDate(next.getDate() + DAYS_IN_RANGE[range] * direction);

    return next;
}

/** The heading for the visible range: a month and year, a single date, or a span. */
export function rangeLabel({
    anchor,
    range,
    locale,
}: {
    anchor: Date;
    range: CalendarRange;
    locale: string;
}): string {
    if (range === 'month') {
        return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor);
    }

    const days = buildDays({ anchor, range });
    const first = days[0] as Date;

    if (range === 'day') {
        return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(first);
    }

    const last = days[days.length - 1] as Date;
    const sameMonth = first.getMonth() === last.getMonth();
    const fromFormat = new Intl.DateTimeFormat(locale, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    const toFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });

    return `${fromFormat.format(first)} – ${toFormat.format(last)}`;
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function countFrom({ start, count }: { start: Date; count: number }): Date[] {
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);

        return date;
    });
}
