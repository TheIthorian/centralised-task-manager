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
});
