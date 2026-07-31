import { Types } from 'mongoose';
import { z } from 'zod';
import { isValidTimeZone } from '@ctm/time';

/**
 * A well-formed MongoDB ObjectId.
 *
 * Without this check a malformed id reaches Mongoose and surfaces as a CastError, which
 * `AppErrorFilter` does not catch: the caller gets a 500 for what is a bad request.
 */
export const objectIdSchema = z
    .string()
    // isValid() accepts any 12-character string, so round-trip to reject those.
    .refine((value) => Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value, {
        message: 'must be a valid id',
    });

/**
 * A request object: rejects unrecognised keys, and reads an explicit `null` as an absent key.
 *
 * Wire types are nullable where input types are optional, so a client round-tripping a response
 * back as a request sends `null` for fields it did not set. `@IsOptional()` accepted that; plain
 * `.optional()` rejects it. Stripping nulls before the object is parsed keeps the tolerance out of
 * the field schemas, so the generated OpenAPI document describes the contract rather than the
 * leniency.
 *
 * Nested objects need their own `requestObject`: only the keys of this object are stripped.
 */
export function requestObject<T extends z.ZodRawShape>(shape: T): z.ZodType<z.infer<z.ZodObject<T>>> {
    return z.preprocess(withoutNulls, z.strictObject(shape)) as unknown as z.ZodType<z.infer<z.ZodObject<T>>>;
}

/** Drops null-valued keys from a plain object, leaving anything else untouched. */
function withoutNulls(value: unknown): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;

    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null));
}

/**
 * The Accept header, defaulted so an absent header parses as no preference.
 *
 * Bounded because the value is only ever substring-matched for content negotiation; nothing
 * downstream needs a full media-type list.
 */
export const acceptHeaderSchema = z.string().max(256).catch('').default('');

/** An email address, bounded at the longest address SMTP permits. */
export const emailSchema = z.string().email().max(320);

/**
 * An IANA time zone identifier.
 *
 * Checked against the runtime's own zone database rather than a pattern: a syntactically plausible
 * id this Node build cannot resolve would throw from `Intl` deep inside a cron, not at the edge.
 */
export const timeZoneSchema = z
    .string()
    .max(64)
    .refine(isValidTimeZone, { message: 'must be an IANA time zone identifier' });

/** A user-supplied password. Length only: strength rules belong to the auth service. */
export const passwordSchema = z.string().min(8).max(255);

/**
 * A boolean carried in a query string.
 *
 * Accepts a real boolean too, so a caller that sends JSON rather than a query string still parses.
 */
export const queryBooleanSchema = z.union([
    z.boolean(),
    z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

/**
 * An ISO 8601 date or datetime, with or without an offset.
 *
 * Matches what `@IsISO8601` accepted, so a client that sent a date-only value to one of these
 * endpoints before still can.
 */
export const isoDateTimeSchema = z.union([
    z.iso.date(),
    z.iso.datetime({ offset: true }),
    z.iso.datetime({ local: true }),
]);
