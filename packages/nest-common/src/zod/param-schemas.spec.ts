import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { ValidationError } from '@ctm/errors';
import { z } from 'zod';
import { isoDateTimeSchema, objectIdSchema, requestObject, queryBooleanSchema } from './param-schemas.js';
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

describe('requestObject', () => {
    const schema = requestObject({ name: z.string().max(4).optional() });

    it.each([
        ['an explicit null', { name: null }],
        ['an explicit undefined', { name: undefined }],
        ['an absent key', {}],
    ])('reads %s as absent', (_label, value) => {
        expect(schema.parse(value)).toEqual({ name: undefined });
    });

    it('still parses a present value', () => {
        expect(schema.parse({ name: 'abc' })).toEqual({ name: 'abc' });
    });

    it('still enforces the inner schema', () => {
        expect(schema.safeParse({ name: 'toolong' }).success).toBe(false);
    });

    it('rejects an unrecognised key', () => {
        expect(schema.safeParse({ name: 'ok', role: 'admin' }).success).toBe(false);
    });

    it('leaves a nested object to its own requestObject', () => {
        const nested = requestObject({ inner: requestObject({ a: z.string().optional() }).optional() });

        expect(nested.parse({ inner: { a: null } })).toEqual({ inner: {} });
    });
});

describe('queryBooleanSchema', () => {
    it.each([
        ['the string true', 'true', true],
        ['the string false', 'false', false],
        ['a real boolean', true, true],
    ])('parses %s', (_label, value, expected) => {
        expect(queryBooleanSchema.parse(value)).toBe(expected);
    });

    it('rejects any other string', () => {
        expect(queryBooleanSchema.safeParse('yes').success).toBe(false);
    });
});

describe('isoDateTimeSchema', () => {
    it.each([
        ['a date', '2026-06-01'],
        ['a UTC datetime', '2026-06-01T14:00:00.000Z'],
        ['a local datetime', '2026-06-01T14:00:00'],
    ])('accepts %s', (_label, value) => {
        expect(isoDateTimeSchema.safeParse(value).success).toBe(true);
    });

    it.each([
        ['a non-date', 'nope'],
        ['an impossible month', '2026-13-01'],
        ['an impossible day', '2026-02-30'],
    ])('rejects %s', (_label, value) => {
        expect(isoDateTimeSchema.safeParse(value).success).toBe(false);
    });
});

describe('ZodParam', () => {
    it('returns the parsed value', () => {
        const pipe = ZodParam(z.coerce.number().int().min(0));

        expect(pipe.transform('3')).toBe(3);
    });

    it('throws a ValidationError carrying the failing path', () => {
        const pipe = ZodParam(z.string().min(1).max(2));

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
