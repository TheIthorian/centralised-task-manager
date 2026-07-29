import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { ValidationError } from '@ctm/errors';
import type { ZodType } from 'zod';
import { zodSchemaOf } from './create-zod-dto.js';

/** Renders Zod issues as a single line, so the client sees every failure at once. */
function formatIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
    return error.issues
        .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
        .join('; ');
}

/**
 * Validates handler arguments whose type was built by `createZodDto`.
 *
 * Registered globally ahead of the class-validator pipe, and passes any other metatype
 * through untouched so the two idioms can coexist during migration.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
    /** Parses the value against the DTO's schema, or returns it unchanged. */
    transform(value: unknown, metadata: ArgumentMetadata): unknown {
        const schema = zodSchemaOf(metadata.metatype);

        if (!schema) return value;

        return parseOrThrow({ schema, value });
    }
}

/**
 * Validates a single primitive `@Param`/`@Query` value, which the DTO-based pipes skip because
 * a primitive metatype carries no schema.
 */
export function ZodParam<T>(schema: ZodType<T>): PipeTransform<unknown, T> {
    return {
        transform: (value: unknown): T => parseOrThrow({ schema, value }),
    };
}

/** Parses a value against a schema, converting a Zod failure into a 400. */
function parseOrThrow<T>({ schema, value }: { schema: ZodType<T>; value: unknown }): T {
    const result = schema.safeParse(value);

    if (!result.success) throw new ValidationError(formatIssues(result.error));

    return result.data;
}
