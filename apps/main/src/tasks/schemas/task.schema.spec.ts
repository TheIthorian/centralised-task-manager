import { describe, it, expect } from 'vitest';
import { TaskSchema } from './task.schema.js';

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
});
