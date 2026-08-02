import { describe, it, expect } from 'vitest';
import type { DueDate, TaskDto } from '@ctm/api-client';
import { bucketTasks } from './bucket-tasks.js';

/** Minimal TaskDto factory — only fields bucketTasks cares about. */
function makeTask(overrides: Partial<TaskDto> & { id: string }): TaskDto {
    return {
        title: 'Test task',
        completed: false,
        source: 'todoist',
        sourceId: overrides.id,
        externalAccountId: null,
        tags: [],
        locations: [],
        relations: [],
        reminders: [],
        dueDateNotifiedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

/** An all-day date: the calendar day it names, with no instant. */
function allDay(date: string): DueDate {
    return { date: `${date}T00:00:00.000Z`, timezone: null, recurrence: null, allDay: true };
}

/** A timed date: an instant, read in whichever zone the viewer is in. */
function timed(iso: string): DueDate {
    return { date: iso, timezone: null, recurrence: null, allDay: false };
}

const LONDON = 'Europe/London';
const AUCKLAND = 'Pacific/Auckland';

// Anchor: Wednesday 2026-05-20, 12:00 in London.
const NOW = new Date('2026-05-20T11:00:00.000Z');

describe('bucketTasks', () => {
    it('puts tasks with no due date in noDate', () => {
        const result = bucketTasks({ tasks: [makeTask({ id: '1' })], timeZone: LONDON, now: NOW });

        expect(result.noDate).toHaveLength(1);
        expect(result.overdue).toHaveLength(0);
        expect(result.today).toHaveLength(0);
    });

    it('puts tasks due before today in overdue', () => {
        const result = bucketTasks({
            tasks: [makeTask({ id: '2', due: allDay('2026-05-19') })],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.overdue.map((task) => task.id)).toEqual(['2']);
    });

    it('puts tasks due today in today', () => {
        const result = bucketTasks({
            tasks: [makeTask({ id: '3', due: allDay('2026-05-20') })],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.today.map((task) => task.id)).toEqual(['3']);
    });

    it('puts tasks due later this week in thisWeek', () => {
        const result = bucketTasks({
            tasks: [makeTask({ id: '4', due: allDay('2026-05-23') })],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.thisWeek.map((task) => task.id)).toEqual(['4']);
    });

    it('treats Sunday as the last day of the week and Monday as the next', () => {
        const result = bucketTasks({
            tasks: [makeTask({ id: 'sun', due: allDay('2026-05-24') }), makeTask({ id: 'mon', due: allDay('2026-05-25') })],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.thisWeek.map((task) => task.id)).toEqual(['sun']);
        expect(result.upcoming.map((task) => task.id)).toEqual(['mon']);
    });

    it('sorts dated buckets ascending by date', () => {
        const result = bucketTasks({
            tasks: [
                makeTask({ id: 'b', due: allDay('2026-05-19') }),
                makeTask({ id: 'a', due: allDay('2026-05-18') }),
            ],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.overdue.map((task) => task.id)).toEqual(['a', 'b']);
    });

    it('puts completed tasks in done regardless of due date', () => {
        const result = bucketTasks({
            tasks: [
                makeTask({ id: 'd1', completed: true, due: allDay('2026-05-20') }),
                makeTask({ id: 'd2', completed: true }),
            ],
            timeZone: LONDON,
            now: NOW,
        });

        expect(result.done).toHaveLength(2);
        expect(result.today).toHaveLength(0);
        expect(result.noDate).toHaveLength(0);
    });

    it('buckets a timed task by the reader own day, not the server day', () => {
        // 22:00 in London on the 20th is 09:00 on the 21st in Auckland.
        const task = makeTask({ id: 'timed', due: timed('2026-05-20T21:00:00.000Z') });

        expect(bucketTasks({ tasks: [task], timeZone: LONDON, now: NOW }).today.map((t) => t.id)).toEqual(['timed']);
        expect(bucketTasks({ tasks: [task], timeZone: AUCKLAND, now: NOW }).today).toHaveLength(0);
    });

    it('keeps an all-day task on its own day in every zone', () => {
        const task = makeTask({ id: 'allday', due: allDay('2026-05-20') });

        expect(bucketTasks({ tasks: [task], timeZone: LONDON, now: NOW }).today.map((t) => t.id)).toEqual(['allday']);
        expect(bucketTasks({ tasks: [task], timeZone: AUCKLAND, now: NOW }).today.map((t) => t.id)).toEqual(['allday']);
    });

    it('does not call a task overdue for a reader whose day has not started', () => {
        // 00:30 on the 20th in London is still the 19th in New York, so nothing due on the 19th
        // is late there yet.
        const task = makeTask({ id: 'edge', due: allDay('2026-05-19') });
        const justAfterMidnightInLondon = new Date('2026-05-19T23:30:00.000Z');

        expect(
            bucketTasks({ tasks: [task], timeZone: LONDON, now: justAfterMidnightInLondon }).overdue,
        ).toHaveLength(1);
        expect(
            bucketTasks({ tasks: [task], timeZone: 'America/New_York', now: justAfterMidnightInLondon }).today,
        ).toHaveLength(1);
    });

    it('defaults now to the current time', () => {
        expect(() => bucketTasks({ tasks: [], timeZone: LONDON })).not.toThrow();
    });
});
