import { createZodDto as createNestZodDto } from 'nestjs-zod';
import { isZodDto } from 'nestjs-zod/dto';
import { z, type ZodType } from 'zod';

/** A DTO class produced by `createZodDto`, carrying the schema it validates against. */
export type ZodDto<T> = {
    new (): T;
    schema: ZodType<T>;
};

/**
 * Builds a DTO class from a Zod object schema.
 *
 * The class exists for two reasons a bare schema cannot serve: NestJS resolves handler
 * parameter metatypes to classes, and `@nestjs/swagger` reads property metadata off a class to
 * generate the OpenAPI reference that `apps/docs` renders. `nestjs-zod` supplies the class with
 * an `_OPENAPI_METADATA_FACTORY` that derives that metadata from the schema, so the schema stays
 * the single source of truth and nested objects, unions and formats survive into the spec.
 *
 * `scripts/generate-openapi.ts` must run the finished document through `cleanupOpenApiDoc`.
 */
export function createZodDto<T>({ schema, name }: { schema: ZodType<T>; name: string }): ZodDto<T> {
    const Dto = createNestZodDto(schema);

    // The generated class is anonymous, and @nestjs/swagger names the OpenAPI component after it.
    Object.defineProperty(Dto, 'name', { value: name });

    return Dto as unknown as ZodDto<T>;
}

/** Returns the Zod schema attached to a DTO class, or undefined for any other type. */
export function zodSchemaOf(metatype: unknown): ZodType | undefined {
    if (!isZodDto(metatype)) return undefined;

    return metatype.schema instanceof z.ZodType ? metatype.schema : undefined;
}
