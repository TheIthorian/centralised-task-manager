import { describe, expect, it } from 'vitest';
import type { TaskDto } from '@ctm/api-client';
import {
    filterTasks,
    hasCondition,
    parseConditions,
    toggleCondition,
    writeConditions,
    type Condition,
} from './task-conditions.js';

const now = new Date(2026, 6, 30, 17, 0);

function makeTask(overrides: Partial<TaskDto> & { id: string }): TaskDto {
    return {
        title: 'A task',
        completed: false,
        priority: 2,
        due: null,
        duration: null,
        source: 'local',
        sourceId: overrides.id,
        externalAccountId: null,
        tags: [],
        locations: [],
        relations: [],
        reminders: [],
        dueDateNotifiedAt: null,
        createdAt: '2026-07-01',
        updatedAt: '2026-07-01',
        ...overrides,
    };
}

function due(date: string): Pick<TaskDto, 'due'> {
    return { due: { date, timezone: null, recurrence: null, allDay: false } };
}

const overdue = makeTask({ id: 'overdue', ...due('2026-07-28') });
const dueToday = makeTask({ id: 'today', ...due('2026-07-30T09:00:00Z'), source: 'todoist' });
const dueThisWeek = makeTask({ id: 'week', ...due('2026-08-03') });
const undated = makeTask({ id: 'undated', source: 'todoist' });

const all = [overdue, dueToday, dueThisWeek, undated];

describe('filterTasks', () => {
    it('keeps everything when nothing is asked for', () => {
        expect(filterTasks({ tasks: all, conditions: [], now })).toHaveLength(4);
    });

    it('measures overdue from the start of today, not the moment', () => {
        const kept = filterTasks({ tasks: all, conditions: [{ kind: 'due', value: 'overdue' }], now });

        expect(kept.map((task) => task.id)).toEqual(['overdue']);
    });

    it('widens across conditions of the same kind', () => {
        const conditions: Condition[] = [
            { kind: 'due', value: 'overdue' },
            { kind: 'due', value: 'today' },
        ];

        expect(filterTasks({ tasks: all, conditions, now }).map((task) => task.id)).toEqual(['overdue', 'today']);
    });

    it('narrows across conditions of different kinds', () => {
        const conditions: Condition[] = [
            { kind: 'due', value: 'today' },
            { kind: 'source', value: 'todoist' },
        ];

        expect(filterTasks({ tasks: all, conditions, now }).map((task) => task.id)).toEqual(['today']);
    });

    it('finds tasks missing a field', () => {
        const conditions: Condition[] = [{ kind: 'field', value: 'noDate' }];

        expect(filterTasks({ tasks: all, conditions, now }).map((task) => task.id)).toEqual(['undated']);
    });

    it('counts a task due in a week as this week, and one beyond it as not', () => {
        const conditions: Condition[] = [{ kind: 'due', value: 'week' }];

        expect(filterTasks({ tasks: all, conditions, now }).map((task) => task.id)).toEqual(['today', 'week']);
    });
});

describe('conditions in the URL', () => {
    it('round trips', () => {
        const conditions: Condition[] = [
            { kind: 'due', value: 'overdue' },
            { kind: 'due', value: 'today' },
            { kind: 'source', value: 'todoist' },
        ];
        const params = writeConditions({ params: new URLSearchParams('filter=all'), conditions });

        expect(params.get('due')).toBe('overdue,today');
        expect(params.get('filter')).toBe('all');
        expect(parseConditions(params)).toEqual(conditions);
    });

    it('drops values it does not recognise rather than rendering an empty list', () => {
        expect(parseConditions(new URLSearchParams('due=someday'))).toEqual([]);
    });

    it('clears a key once its last condition is removed', () => {
        const params = writeConditions({ params: new URLSearchParams('due=today'), conditions: [] });

        expect(params.has('due')).toBe(false);
    });
});

describe('toggleCondition', () => {
    it('adds then removes', () => {
        const condition: Condition = { kind: 'due', value: 'today' };
        const added = toggleCondition({ conditions: [], condition });

        expect(hasCondition({ conditions: added, condition })).toBe(true);
        expect(toggleCondition({ conditions: added, condition })).toEqual([]);
    });
});
