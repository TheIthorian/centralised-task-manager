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
