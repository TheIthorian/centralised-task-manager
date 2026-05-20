import { describe, it, expect } from 'vitest';
import { UserSchema } from './user.schema.js';

describe('UserSchema', () => {
    it('has a unique index on email', () => {
        const indexes = UserSchema.indexes();
        const emailIndex = indexes.find(([fields]) => 'email' in (fields as Record<string, unknown>));
        expect(emailIndex).toBeDefined();
    });
});
