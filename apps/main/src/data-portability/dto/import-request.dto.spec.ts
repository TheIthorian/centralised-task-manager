import { describe, it, expect } from 'vitest';
import { importRequestSchema } from './import-request.dto.js';

describe('importRequestSchema', () => {
    it('defaults onConflict to ignore when the field is absent', () => {
        expect(importRequestSchema.parse({})).toEqual({ onConflict: 'ignore' });
    });

    it.each([['replace'], ['ignore']])('accepts %s', (value) => {
        expect(importRequestSchema.parse({ onConflict: value })).toEqual({ onConflict: value });
    });

    // Previously an unrecognised value fell through to the default, so a caller asking to replace
    // could silently have everything skipped instead.
    it('rejects an unrecognised value rather than falling back to the default', () => {
        expect(importRequestSchema.safeParse({ onConflict: 'overwrite' }).success).toBe(false);
    });
});
