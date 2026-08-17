import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { ValidationError } from '@ctm/errors';
import { Task, relate, unrelate, type TaskState } from './task.js';

const due = { date: new Date('2026-03-01T09:00:00.000Z'), timezone: null, recurrence: null };

describe('Task', () => {
    it('leaves the original untouched when a change is applied', () => {
        const task = makeTask({ status: 'open' });
        const completed = task.complete();

        expect(completed.status).toBe('done');
        expect(task.status).toBe('open');
    });

    it('reports a deadline as one value rather than two nullable fields', () => {
        expect(makeTask({ due }).deadline).toEqual({ kind: 'exact', due });
        expect(makeTask({}).deadline).toEqual({ kind: 'none' });
    });

    it('clears the fuzzy bucket when an exact date is set', () => {
        const task = makeTask({ fuzzyDeadline: { type: 'this_week', remindEvery: 'daily' } });

        const state = task.withDeadline({ kind: 'exact', due }).toState();

        expect(state.due).toEqual(due);
        expect(state.fuzzyDeadline).toBeNull();
    });

    it('clears an exact date when a fuzzy bucket is set', () => {
        const fuzzy = { type: 'someday' as const, remindEvery: null };

        const state = makeTask({ due }).withDeadline({ kind: 'fuzzy', fuzzy }).toState();

        expect(state.due).toBeNull();
        expect(state.fuzzyDeadline).toEqual(fuzzy);
    });

    it('drops the fuzzy bucket while keeping an exact date, even when a document stores both', () => {
        const task = makeTask({ due, fuzzyDeadline: { type: 'this_week', remindEvery: 'daily' } });

        const state = task.withoutFuzzyDeadline().toState();

        expect(state.due).toEqual(due);
        expect(state.fuzzyDeadline).toBeNull();
    });

    it('ignores a relation that is already present', () => {
        const targetTaskId = new Types.ObjectId();
        const task = makeTask({}).addRelation({ type: 'parent', targetTaskId });

        expect(task.addRelation({ type: 'parent', targetTaskId }).relations).toHaveLength(1);
    });

    it('removes only the relation named, not every relation to that task', () => {
        const targetTaskId = new Types.ObjectId();

        const task = makeTask({})
            .addRelation({ type: 'parent', targetTaskId })
            .addRelation({ type: 'related', targetTaskId })
            .removeRelation({ type: 'parent', targetTaskId });

        expect(task.relations).toHaveLength(1);
        expect(task.relations[0]!.type).toBe('related');
    });

    it('removes every relation to a task that has been deleted', () => {
        const targetTaskId = new Types.ObjectId();
        const other = new Types.ObjectId();

        const task = makeTask({})
            .addRelation({ type: 'parent', targetTaskId })
            .addRelation({ type: 'related', targetTaskId })
            .addRelation({ type: 'next', targetTaskId: other })
            .removeRelationsTo(targetTaskId);

        expect(task.relations).toHaveLength(1);
        expect(task.relations[0]!.targetTaskId).toEqual(other);
    });

    it('rejects a reminder index outside the list', () => {
        const task = makeTask({ reminders: [{ remindAt: new Date(), firedAt: null }] });

        expect(() => task.removeReminderAt(1)).toThrow(ValidationError);
        expect(() => task.removeReminderAt(-1)).toThrow(ValidationError);
    });
});

describe('relate', () => {
    it('writes the inverse type on the target', () => {
        const sourceId = new Types.ObjectId();
        const targetId = new Types.ObjectId();

        const { source, target } = relate({
            source: makeTask({}),
            sourceId,
            target: makeTask({}),
            targetId,
            type: 'parent',
        });

        expect(source.relations).toEqual([{ type: 'parent', targetTaskId: targetId }]);
        expect(target.relations).toEqual([{ type: 'child', targetTaskId: sourceId }]);
    });

    it('refuses to relate a task to itself', () => {
        const id = new Types.ObjectId();

        expect(() =>
            relate({ source: makeTask({}), sourceId: id, target: makeTask({}), targetId: id, type: 'related' }),
        ).toThrow(ValidationError);
    });

    it('clears both halves again', () => {
        const sourceId = new Types.ObjectId();
        const targetId = new Types.ObjectId();
        const linked = relate({
            source: makeTask({}),
            sourceId,
            target: makeTask({}),
            targetId,
            type: 'next',
        });

        const { source, target } = unrelate({ ...linked, sourceId, targetId, type: 'next' });

        expect(source.relations).toHaveLength(0);
        expect(target.relations).toHaveLength(0);
    });
});

function makeTask(state: Partial<TaskState>): Task {
    return Task.fromState({
        status: 'open',
        due: null,
        fuzzyDeadline: null,
        relations: [],
        reminders: [],
        ...state,
    });
}
