import type { TFunction } from 'i18next';
import type { TaskDto } from '@ctm/api-client';

/**
 * One sentence for the due state, because "13 July, 2 days late, repeats every 12 months"
 * is a single fact to a reader even though it is three fields to the API. Dates go through
 * `Intl` so they follow the reader's own locale.
 */
export function formatDueLabel({
    task,
    locale,
    t,
}: {
    task: TaskDto;
    locale: string;
    t: TFunction;
}): { label: string; overdue: boolean } | undefined {
    if (!task.due) return task.deadlineDate ? { label: formatDate({ iso: task.deadlineDate, locale }), overdue: false } : undefined;

    const dueAt = new Date(task.due.date);
    const overdue = !task.completed && dueAt.getTime() < Date.now();
    const daysLate = Math.floor((Date.now() - dueAt.getTime()) / 86_400_000);

    if (overdue && daysLate >= 1) return { label: t('tasks.daysLate', { count: daysLate }), overdue: true };

    return { label: formatDate({ iso: task.due.date, locale }), overdue };
}

/** Short date in the reader's locale. */
export function formatDate({ iso, locale }: { iso: string; locale: string }): string {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
}
