import type { TaskDto } from '@ctm/api-client';
import { startOfLastDayOfWeek, toDateKey } from '@ctm/time';
import { dueDateKey } from './timezone.js';

export type TaskBuckets = {
    overdue: TaskDto[];
    today: TaskDto[];
    thisWeek: TaskDto[];
    upcoming: TaskDto[];
    noDate: TaskDto[];
    done: TaskDto[];
};

/**
 * Partition tasks into due-date buckets ordered by urgency.
 *
 * Buckets are decided by comparing date keys rather than instants, so the boundaries are the
 * reader's own midnights. Pass `now` explicitly in tests to avoid time-dependent failures.
 */
export function bucketTasks({
    tasks,
    timeZone,
    now = new Date(),
}: {
    tasks: TaskDto[];
    timeZone: string;
    now?: Date;
}): TaskBuckets {
    const todayKey = toDateKey({ instant: now, timeZone });
    const weekEndKey = toDateKey({ instant: startOfLastDayOfWeek({ instant: now, timeZone }), timeZone });

    const overdue: TaskDto[] = [];
    const today: TaskDto[] = [];
    const thisWeek: TaskDto[] = [];
    const upcoming: TaskDto[] = [];
    const noDate: TaskDto[] = [];
    const done: TaskDto[] = [];

    for (const task of tasks) {
        if (task.completed) {
            done.push(task);
            continue;
        }

        const dueKey = dueDateKey({ task, timeZone });

        if (!dueKey) {
            noDate.push(task);
            continue;
        }

        if (dueKey < todayKey) {
            overdue.push(task);
        } else if (dueKey === todayKey) {
            today.push(task);
        } else if (dueKey <= weekEndKey) {
            thisWeek.push(task);
        } else {
            upcoming.push(task);
        }
    }

    const byDate = (a: TaskDto, b: TaskDto): number => (a.due?.date ?? '').localeCompare(b.due?.date ?? '');

    overdue.sort(byDate);
    today.sort(byDate);
    thisWeek.sort(byDate);
    upcoming.sort(byDate);

    return { overdue, today, thisWeek, upcoming, noDate, done };
}
