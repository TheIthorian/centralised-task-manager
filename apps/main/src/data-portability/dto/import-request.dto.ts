import { z } from 'zod';
import type { ImportRequestDto as IImportRequestDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { requestObject } from '../../common/zod/param-schemas.js';

// Defaulted so an upload that sends only files still parses; the safe choice is to keep
// whatever the account already has.
export const importRequestSchema = requestObject({
    onConflict: z.enum(['replace', 'ignore']).default('ignore'),
});

export class ImportRequestDto extends createZodDto<IImportRequestDto>({
    schema: importRequestSchema,
    name: 'ImportRequestDto',
}) {}
