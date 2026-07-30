import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { ValidationError } from '@ctm/errors';
import { z } from 'zod';
import { boundedString, objectIdSchema } from './param-schemas.js';
import { ZodParam } from './zod-param.js';
import { createZodDto, zodSchemaOf } from './create-zod-dto.js';

describe('objectIdSchema', () => {
    it('accepts a valid ObjectId', () => {
        const id = new Types.ObjectId().toHexString();

        expect(objectIdSchema.parse(id)).toBe(id);
    });

    it.each([
        ['a short string', 'abc'],
        ['a non-hex string of the right length', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
        ['an empty string', ''],
        ['a Mongo operator', '{"$ne":null}'],
        // isValid() accepts any 12-byte string, so the round-trip check has to reject these.
        ['a 12-character string', '123456789012'],
    ])('rejects %s', (_label, value) => {
        expect(objectIdSchema.safeParse(value).success).toBe(false);
    });
});

describe('boundedString', () => {
    const schema = boundedString({ maxLength: 8 });

    it('accepts a value within the bound', () => {
        expect(schema.parse('abc')).toBe('abc');
    });

    it.each([
        ['an over-long value', 'x'.repeat(9)],
        ['an empty string', ''],
        ['undefined', undefined],
        ['an array', ['a']],
    ])('rejects %s', (_label, value) => {
        expect(schema.safeParse(value).success).toBe(false);
    });
});

describe('ZodParam', () => {
    it('returns the parsed value', () => {
        const pipe = ZodParam(z.coerce.number().int().min(0));

        expect(pipe.transform('3')).toBe(3);
    });

    it('throws a ValidationError carrying the failing path', () => {
        const pipe = ZodParam(boundedString({ maxLength: 2 }));

        expect(() => pipe.transform('toolong')).toThrow(ValidationError);
    });
});

describe('createZodDto', () => {
    const schema = z.object({ name: z.string().max(4), count: z.number().optional() });

    class ExampleDto extends createZodDto({ schema, name: 'ExampleDto' }) {}

    it('exposes the schema for the pipe to find', () => {
        expect(zodSchemaOf(ExampleDto)).toBe(schema);
    });

    it('returns undefined for a class with no schema', () => {
        expect(zodSchemaOf(class Plain {})).toBeUndefined();
    });

    it('keeps the given class name, so OpenAPI model names stay stable', () => {
        expect(ExampleDto.name).toBe('ExampleDto');
    });

    it('strips unknown keys rather than rejecting them', () => {
        expect(schema.parse({ name: 'abc', extra: 1 })).toEqual({ name: 'abc' });
    });
});
