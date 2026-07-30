import { ApiProperty, ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';
import type { ZodType } from 'zod';
import { z } from 'zod';

/** A DTO class produced by `createZodDto`, carrying the schema it validates against. */
export type ZodDto<T> = {
    new (): T;
    zodSchema: ZodType<T>;
};

type JsonSchemaProperty = {
    type?: string | string[];
    enum?: unknown[];
    items?: { type?: string | string[]; enum?: unknown[] };
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
    description?: string;
    format?: string;
};

/** Converts a snake_case or camelCase property key to PascalCase, for naming enum schemas. */
function pascalCase(key: string): string {
    return key.replace(/(^|_)([a-z])/g, (_match, _sep, letter: string) => letter.toUpperCase());
}

/** Maps a JSON Schema type to the constructor `@nestjs/swagger` expects. */
function swaggerTypeOf(type: string | string[] | undefined): FunctionConstructor | ObjectConstructor {
    // Unions surface as an array of types; the first entry is the representable one.
    switch (Array.isArray(type) ? type[0] : type) {
        case 'string':
            return String as unknown as FunctionConstructor;
        case 'number':
        case 'integer':
            return Number as unknown as FunctionConstructor;
        case 'boolean':
            return Boolean as unknown as FunctionConstructor;
        case 'array':
            return Array as unknown as FunctionConstructor;
        default:
            return Object;
    }
}

/**
 * Builds a DTO class from a Zod object schema.
 *
 * The class exists for two reasons a bare schema cannot serve: NestJS resolves handler
 * parameter metatypes to classes, and `@nestjs/swagger` reads `@ApiProperty` metadata off a
 * class to generate the OpenAPI reference that `apps/docs` renders. Property metadata is
 * derived from the schema via `z.toJSONSchema`, so the schema stays the single source of truth.
 */
export function createZodDto<T>({ schema, name }: { schema: ZodType<T>; name: string }): ZodDto<T> {
    class Dto {
        static readonly zodSchema = schema;
    }

    Object.defineProperty(Dto, 'name', { value: name });

    const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as {
        properties?: Record<string, JsonSchemaProperty>;
        required?: string[];
    };

    const required = new Set(jsonSchema.required ?? []);

    for (const [key, property] of Object.entries(jsonSchema.properties ?? {})) {
        const type = Array.isArray(property.type) ? property.type[0] : property.type;

        const decorate = required.has(key) ? ApiProperty : ApiPropertyOptional;

        // An array of enums carries its values on `items`, a scalar enum on the property itself.
        const enumValues = type === 'array' ? property.items?.enum : property.enum;

        const options: ApiPropertyOptions = {
            ...(enumValues
                ? { enum: enumValues, enumName: `${name}${pascalCase(key)}` }
                : { type: swaggerTypeOf(type === 'array' ? property.items?.type : type) }),
            ...(type === 'array' ? { isArray: true } : {}),
            ...(property.minLength === undefined ? {} : { minLength: property.minLength }),
            ...(property.maxLength === undefined ? {} : { maxLength: property.maxLength }),
            ...(property.minItems === undefined ? {} : { minItems: property.minItems }),
            ...(property.maxItems === undefined ? {} : { maxItems: property.maxItems }),
            ...(property.description === undefined ? {} : { description: property.description }),
        };

        decorate(options)(Dto.prototype, key);
    }

    return Dto as unknown as ZodDto<T>;
}

/** Returns the Zod schema attached to a DTO class, or undefined for any other type. */
export function zodSchemaOf(metatype: unknown): ZodType | undefined {
    if (typeof metatype !== 'function') return undefined;

    const candidate = (metatype as { zodSchema?: unknown }).zodSchema;

    return candidate instanceof z.ZodType ? candidate : undefined;
}
