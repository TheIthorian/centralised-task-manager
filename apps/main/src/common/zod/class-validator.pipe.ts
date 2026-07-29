import { Injectable, ValidationPipe, type ArgumentMetadata } from '@nestjs/common';
import { zodSchemaOf } from './create-zod-dto.js';

/**
 * The class-validator pipe, made to ignore Zod DTOs.
 *
 * A Zod DTO carries no class-validator decorators, so `forbidNonWhitelisted` would treat every
 * field as unrecognised and reject the request that `ZodValidationPipe` just accepted. Skipping
 * those metatypes lets both idioms coexist while DTOs are migrated.
 */
@Injectable()
export class ClassValidatorPipe extends ValidationPipe {
    /** Delegates to the standard pipe unless the metatype is a Zod DTO. */
    override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
        if (zodSchemaOf(metadata.metatype)) return value;

        return super.transform(value, metadata);
    }
}
