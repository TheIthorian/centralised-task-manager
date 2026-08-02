import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@ctm/api-client';
import { formatDueLabel } from './format-task.js';

const t = ((key: string, options?: Record<string, unknown>): string =>
    key === 'tasks.daysLate' ? `${String(options?.['count'])} days late` : key) as never;

const LONDON = 'Europe/London';
const AUCKLAND = 'Pacific/Auckland';

const NOW = new Date('2026-07-30T11:00:00.000Z');

function task({ due, allDay = true }: { due: string | null; allDay?: boolean }): TaskDto {
    return {
        id: 't1',
        title: 'Renew home insurance',
        completed: false,
        due: due === null ? null : { date: due, timezone: null, recurrence: null, allDay },
    } as unknown as TaskDto;
}

describe('formatDueLabel', () => {
    it('counts a task due yesterday as late', () => {
        const result = formatDueLabel({
            task: task({ due: '2026-07-29T00:00:00.000Z' }),
            locale: 'en-GB',
            timeZone: LONDON,
            t,
            now: NOW,
        });

        expect(result).toEqual({ label: '1 days late', overdue: true });
    });

    it('does not treat a task due earlier today as late', () => {
        const result = formatDueLabel({
            task: task({ due: '2026-07-30T06:00:00.000Z', allDay: false }),
            locale: 'en-GB',
            timeZone: LONDON,
            t,
            now: NOW,
        });

        expect(result?.overdue).toBe(false);
    });

    it('measures lateness against the reader own midnight', () => {
        // 13:00Z on the 30th is still the 30th in London but already the 31st in Auckland, so a
        // task due on the 30th is late in one place and not the other.
        const dueToday = task({ due: '2026-07-30T00:00:00.000Z' });
        const evening = new Date('2026-07-30T13:00:00.000Z');

        expect(formatDueLabel({ task: dueToday, locale: 'en-GB', timeZone: LONDON, t, now: evening })?.overdue).toBe(
            false,
        );
        expect(formatDueLabel({ task: dueToday, locale: 'en-GB', timeZone: AUCKLAND, t, now: evening })?.overdue).toBe(
            true,
        );
    });

    it('renders an all-day date as the same day in every zone', () => {
        const dueSoon = task({ due: '2026-08-05T00:00:00.000Z' });
        const inLondon = formatDueLabel({ task: dueSoon, locale: 'en-GB', timeZone: LONDON, t, now: NOW });
        const inAuckland = formatDueLabel({ task: dueSoon, locale: 'en-GB', timeZone: AUCKLAND, t, now: NOW });

        expect(inLondon?.label).toBe('5 Aug');
        expect(inAuckland?.label).toBe(inLondon?.label);
    });

    it('never marks a completed task as late', () => {
        const done = { ...task({ due: '2026-07-01T00:00:00.000Z' }), completed: true };

        expect(formatDueLabel({ task: done, locale: 'en-GB', timeZone: LONDON, t, now: NOW })?.overdue).toBe(false);
    });

    it('returns nothing when the task has no dates', () => {
        expect(
            formatDueLabel({ task: task({ due: null }), locale: 'en-GB', timeZone: LONDON, t, now: NOW }),
        ).toBeUndefined();
    });
});
