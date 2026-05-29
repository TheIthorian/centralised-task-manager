import type { TaskDto } from '@ctm/api-client';

export type TaskBuckets = {
    overdue: TaskDto[];
    today: TaskDto[];
    thisWeek: TaskDto[];
    upcoming: TaskDto[];
    noDate: TaskDto[];
    done: TaskDto[];
};

/** Parse an ISO date string (YYYY-MM-DD or full ISO-8601) to a local-timezone Date at midnight. */
function parseDateOnly(iso: string): Date {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

    return new Date(year, (month as number) - 1, day as number);
}

/** Monday of the week containing `d` (local time). */
function startOfWeek(d: Date): Date {
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysToMonday);

    return monday;
}

/** Sunday (end of week) of the week containing `d` (local time). */
function endOfWeek(d: Date): Date {
    const monday = startOfWeek(d);

    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
}

/**
 * Partition tasks into due-date buckets ordered by urgency.
 * Pass `now` explicitly in tests to avoid time-dependent failures.
 */
export function bucketTasks(tasks: TaskDto[], now: Date = new Date()): TaskBuckets {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = endOfWeek(todayStart);

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

        if (!task.due) {
            noDate.push(task);
            continue;
        }

        const due = parseDateOnly(task.due.date);

        if (due < todayStart) {
            overdue.push(task);
        } else if (due.getTime() === todayStart.getTime()) {
            today.push(task);
        } else if (due <= weekEnd) {
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
