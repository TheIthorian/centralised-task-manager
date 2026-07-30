/** Snoozed work is morning work: pushing to midnight would bury it under the overdue rows. */
const SNOOZE_HOUR = 9;

/**
 * Where a snoozed task lands: tomorrow morning in the reader's own timezone, since a swipe
 * means "not today" rather than a precise time.
 */
export function nextMorning({ from = new Date() }: { from?: Date } = {}): Date {
    const target = new Date(from);

    target.setDate(target.getDate() + 1);
    target.setHours(SNOOZE_HOUR, 0, 0, 0);

    return target;
}
