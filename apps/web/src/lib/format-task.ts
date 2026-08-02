import type { TFunction } from 'i18next';
import type { TaskDto } from '@ctm/api-client';
import { differenceInCalendarDays, instantFromWallClock, toDateKey, UTC } from '@ctm/time';
import { dueDateKey } from './timezone.js';

/**
 * One sentence for the due state, because "13 July, 2 days late, repeats every 12 months"
 * is a single fact to a reader even though it is three fields to the API. Dates go through
 * `Intl` so they follow the reader's own locale.
 */
export function formatDueLabel({
    task,
    locale,
    timeZone,
    t,
    now = new Date(),
}: {
    task: TaskDto;
    locale: string;
    timeZone: string;
    t: TFunction;
    now?: Date;
}): { label: string; overdue: boolean } | undefined {
    if (!task.due) {
        return task.deadlineDate
            ? { label: formatDate({ iso: task.deadlineDate, locale, timeZone }), overdue: false }
            : undefined;
    }

    const dueKey = dueDateKey({ task, timeZone });
    const todayKey = toDateKey({ instant: now, timeZone });

    // Overdue is measured in days, not minutes: a task due at 09:00 today is not late at
    // 09:01, and colouring it as late would spend the warning colour on nothing.
    const overdue = !task.completed && dueKey !== undefined && dueKey < todayKey;

    if (overdue && dueKey !== undefined) {
        const daysLate = daysBetweenKeys({ from: dueKey, to: todayKey });

        if (daysLate >= 1) return { label: t('tasks.daysLate', { count: daysLate }), overdue: true };
    }

    return {
        label: formatDate({ iso: task.due.date, locale, timeZone: task.due.allDay ? UTC : timeZone }),
        overdue,
    };
}

/** Short date in the reader's locale, read in the given zone. */
export function formatDate({ iso, locale, timeZone }: { iso: string; locale: string; timeZone: string }): string {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
}

function daysBetweenKeys({ from, to }: { from: string; to: string }): number {
    return differenceInCalendarDays({
        from: instantFromWallClock({ dateKey: from, timeZone: UTC }),
        to: instantFromWallClock({ dateKey: to, timeZone: UTC }),
        timeZone: UTC,
    });
}
