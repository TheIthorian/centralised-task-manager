import { describe, it, expect } from 'vitest';
import { model, Types } from 'mongoose';
import { TaskSchema, RELATION_INVERSE } from './task.schema.js';

describe('TaskSchema', () => {
    it('has compound unique index on userId+source+sourceId', () => {
        const indexes = TaskSchema.indexes();
        const compound = indexes.find(([fields]) => {
            const f = fields as Record<string, unknown>;
            return 'userId' in f && 'source' in f && 'sourceId' in f;
        });
        expect(compound).toBeDefined();
        expect(compound?.[1]).toMatchObject({ unique: true });
    });

    it('enforces max lengths on core text fields', () => {
        expect(TaskSchema.path('source').options.maxlength).toBe(50);
        expect(TaskSchema.path('sourceId').options.maxlength).toBe(255);
        expect(TaskSchema.path('title').options.maxlength).toBe(200);
        expect(TaskSchema.path('description').options.maxlength).toBe(2000);
    });

    it('has locations array field defaulting to []', () => {
        const locationsPath = TaskSchema.path('locations');
        expect(locationsPath).toBeDefined();
        expect(locationsPath.options.default).toEqual([]);
    });

    it('has due sub-document with date, timezone, recurrence', () => {
        const duePath = TaskSchema.path('due');
        expect(duePath).toBeDefined();
        expect(TaskSchema.path('due.date')).toBeDefined();
        expect(TaskSchema.path('due.timezone')).toBeDefined();
        expect(TaskSchema.path('due.recurrence')).toBeDefined();
    });

    it('has deadlineDate field defaulting to null', () => {
        const path = TaskSchema.path('deadlineDate');
        expect(path).toBeDefined();
        expect(path.options.default).toBeNull();
    });

    it('has duration sub-document with amount and unit', () => {
        expect(TaskSchema.path('duration.amount')).toBeDefined();
        expect(TaskSchema.path('duration.unit')).toBeDefined();
    });

    it('no longer has a parentId field', () => {
        expect(TaskSchema.path('parentId')).toBeUndefined();
    });

    it('has relations field defaulting to []', () => {
        const TaskModel = model('TaskRelTest_' + Date.now(), TaskSchema);
        const t = new TaskModel({
            userId: new Types.ObjectId(),
            source: 'local',
            sourceId: 's1',
            title: 't',
            syncedAt: new Date(),
        });

        expect(Array.isArray(t.relations)).toBe(true);
        expect(t.relations).toHaveLength(0);
    });

    it('exposes RELATION_INVERSE mapping each type to its inverse', () => {
        expect(RELATION_INVERSE.parent).toBe('child');
        expect(RELATION_INVERSE.child).toBe('parent');
        expect(RELATION_INVERSE.next).toBe('previous');
        expect(RELATION_INVERSE.previous).toBe('next');
        expect(RELATION_INVERSE.related).toBe('related');
    });

    it('does not have sourceDueDate field', () => {
        expect(TaskSchema.path('sourceDueDate')).toBeUndefined();
    });
});
