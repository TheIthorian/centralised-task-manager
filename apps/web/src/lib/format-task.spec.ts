import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@ctm/api-client';
import { formatDueLabel } from './format-task.js';

const t = ((key: string, options?: Record<string, unknown>): string =>
    key === 'tasks.daysLate' ? `${String(options?.['count'])} days late` : key) as never;

function task(dueOffsetDays: number | null): TaskDto {
    const due = new Date();
    due.setDate(due.getDate() + (dueOffsetDays ?? 0));

    return {
        id: 't1',
        title: 'Renew home insurance',
        completed: false,
        due: dueOffsetDays === null ? null : { date: due.toISOString(), timezone: 'Europe/London', recurrence: null },
    } as unknown as TaskDto;
}

describe('formatDueLabel', () => {
    it('counts a task due yesterday as late', () => {
        expect(formatDueLabel({ task: task(-1), locale: 'en-GB', t })).toEqual({ label: '1 days late', overdue: true });
    });

    it('does not treat a task due earlier today as late', () => {
        const result = formatDueLabel({ task: task(0), locale: 'en-GB', t });

        expect(result?.overdue).toBe(false);
    });

    it('returns nothing when the task has no dates', () => {
        expect(formatDueLabel({ task: task(null), locale: 'en-GB', t })).toBeUndefined();
    });
});
