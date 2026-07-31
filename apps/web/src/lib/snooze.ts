import { addDays, instantFromWallClock, toDateKey } from '@ctm/time';

/** Snoozed work is morning work: pushing to midnight would bury it under the overdue rows. */
const SNOOZE_HOUR = 9;

/**
 * Where a snoozed task lands: tomorrow morning in the reader's own timezone, since a swipe
 * means "not today" rather than a precise time.
 *
 * Resolved to an instant here, at the moment of the write, rather than left as a wall clock. A
 * traveller keeps the instant the swipe agreed to, which is the rule every other timed due date
 * follows.
 */
export function nextMorning({ timeZone, from = new Date() }: { timeZone: string; from?: Date }): Date {
    return instantFromWallClock({
        dateKey: toDateKey({ instant: addDays({ instant: from, days: 1, timeZone }), timeZone }),
        hour: SNOOZE_HOUR,
        timeZone,
    });
}
