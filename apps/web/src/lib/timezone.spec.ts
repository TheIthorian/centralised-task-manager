import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@ctm/api-client';
import { browserTimeZone, dueDateKey } from './timezone.js';

function task({ date, allDay }: { date: string; allDay: boolean }): TaskDto {
    return { id: 't1', title: 'Task', completed: false, due: { date, timezone: null, recurrence: null, allDay } } as
        unknown as TaskDto;
}

describe('dueDateKey', () => {
    it('reads an all-day date in UTC, so every reader sees the same day', () => {
        const allDay = task({ date: '2026-07-13T00:00:00.000Z', allDay: true });

        expect(dueDateKey({ task: allDay, timeZone: 'Pacific/Auckland' })).toBe('2026-07-13');
        expect(dueDateKey({ task: allDay, timeZone: 'America/New_York' })).toBe('2026-07-13');
    });

    it('reads a timed date in the reader zone, so it can fall on different days', () => {
        const timed = task({ date: '2026-07-13T23:30:00.000Z', allDay: false });

        expect(dueDateKey({ task: timed, timeZone: 'Pacific/Auckland' })).toBe('2026-07-14');
        expect(dueDateKey({ task: timed, timeZone: 'America/New_York' })).toBe('2026-07-13');
    });

    it('is undefined for a task with no due date', () => {
        expect(dueDateKey({ task: { id: 't', due: null } as unknown as TaskDto, timeZone: 'UTC' })).toBeUndefined();
    });
});

describe('browserTimeZone', () => {
    it('reports a zone the time helpers accept', () => {
        expect(() => dueDateKey({ task: task({ date: '2026-07-13T00:00:00.000Z', allDay: true }), timeZone: browserTimeZone() })).not.toThrow();
    });
});
