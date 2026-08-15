import { Body, Param, Query, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ZodType } from 'zod';
import { zodSchemaOf, type ZodDto } from '../zod/create-zod-dto.js';
import { parseOrThrow, ZodParam } from '../zod/zod-param.js';

/** Either a `createZodDto` class or a bare schema. */
export type SchemaSource = ZodType | ZodDto<unknown>;

/**
 * Validates the whole request body against a DTO or schema.
 *
 * Prefer this to a bare `@Body()`: the schema is named at the call site, so a reader can see the
 * argument is checked without having to know which idiom the DTO happens to use. The startup
 * audit requires it.
 */
export function ValidatedBody(source: SchemaSource): ParameterDecorator {
    return Body(ZodParam(schemaOf(source)));
}

/** Validates the whole query string against a DTO or schema. */
export function ValidatedQuery(source: SchemaSource): ParameterDecorator {
    return Query(ZodParam(schemaOf(source)));
}

/** Validates a single route parameter. */
export function ValidatedParam({ name, schema }: { name: string; schema: ZodType }): ParameterDecorator {
    return Param(name, ZodParam(schema));
}

/** Validates a single named query-string value. */
export function ValidatedQueryValue({ name, schema }: { name: string; schema: ZodType }): ParameterDecorator {
    return Query(name, ZodParam(schema));
}

/**
 * Validates a single request header.
 *
 * Nest's `@Headers` accepts no pipes, so this reads the header itself instead of delegating.
 * Header names are lowercased, since the adapter normalises them.
 */
export function ValidatedHeader({ name, schema }: { name: string; schema: ZodType }): ParameterDecorator {
    return headerDecorator({ name: name.toLowerCase(), schema });
}

/** Unwraps a DTO class to its schema, or returns a bare schema unchanged. */
function schemaOf(source: SchemaSource): ZodType {
    return zodSchemaOf(source) ?? (source as ZodType);
}

const headerDecorator = createParamDecorator(
    ({ name, schema }: { name: string; schema: ZodType }, ctx: ExecutionContext): unknown => {
        const request = ctx.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();

        return parseOrThrow({ schema, value: request.headers[name] });
    },
);
