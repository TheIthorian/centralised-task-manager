import type { TaskDto } from '@ctm/api-client';
import { isValidTimeZone, toDateKey, UTC, type DateKey } from '@ctm/time';

/**
 * The zone this browser is set to, or UTC if it reports something unusable.
 *
 * Falling back to UTC rather than throwing: a reader whose browser cannot name its own zone should
 * still see a task list, and UTC is the same default the server stores.
 */
export function browserTimeZone(): string {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return resolved && isValidTimeZone(resolved) ? resolved : UTC;
}

/**
 * Which calendar day a task belongs to.
 *
 * An all-day task names a day rather than a moment, so it is read in UTC and lands on the same day
 * for every reader. A timed task is an instant, so it is read in the reader's own zone: 09:00 in
 * London genuinely is the next day in Auckland.
 */
export function dueDateKey({ task, timeZone }: { task: TaskDto; timeZone: string }): DateKey | undefined {
    if (!task.due) return undefined;

    return toDateKey({ instant: new Date(task.due.date), timeZone: task.due.allDay ? UTC : timeZone });
}
