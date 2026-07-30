import type { PipeTransform } from '@nestjs/common';
import { ValidationError } from '@ctm/errors';
import type { ZodType } from 'zod';

/**
 * Builds a pipe that parses one value against a schema.
 *
 * Used by the `Validated*` decorators rather than called directly from a controller.
 */
export function ZodParam<T>(schema: ZodType<T>): PipeTransform<unknown, T> {
    return {
        transform: (value: unknown): T => parseOrThrow({ schema, value }),
    };
}

/** Parses a value against a schema, converting a Zod failure into a 400. */
export function parseOrThrow<T>({ schema, value }: { schema: ZodType<T>; value: unknown }): T {
    const result = schema.safeParse(value);

    if (!result.success) throw new ValidationError(formatIssues(result.error));

    return result.data;
}

/** Renders Zod issues as a single line, so the client sees every failure at once. */
function formatIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
    return error.issues
        .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ');
}
