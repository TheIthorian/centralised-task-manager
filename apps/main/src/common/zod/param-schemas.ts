import { Types } from 'mongoose';
import { z } from 'zod';

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
 * A non-empty string with an upper bound, for `@Param`/`@Query` values that have no DTO.
 * Primitive arguments carry no schema of their own, so an unbounded value would otherwise
 * reach the handler and, for provider callbacks, an outbound HTTP request.
 */
export function boundedString({ maxLength }: { maxLength: number }): z.ZodString {
    return z.string().min(1).max(maxLength);
}

/**
 * Marks a field optional and tolerant of an explicit `null`, normalising it to absent.
 *
 * Wire types are nullable where input types are optional, so a client round-tripping a response
 * back as a request sends `null` for fields it did not set. `@IsOptional()` treated null as absent;
 * plain `.optional()` would reject it.
 */
export function optionalOrNull<T extends z.ZodType>(
    schema: T,
): z.ZodOptional<z.ZodType<z.output<T> | undefined, z.input<T> | null | undefined>> {
    // The trailing .optional() is what marks the key optional on the enclosing object: the
    // transform wraps the schema in a pipe, which loses the marker .nullish() added.
    return schema
        .nullish()
        .transform((value) => value ?? undefined)
        .optional();
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
