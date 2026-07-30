import { z } from 'zod';
import type { SetFuzzyDeadlineDto as ISetFuzzyDeadlineDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { optionalOrNull } from '../../common/zod/param-schemas.js';

export const setFuzzyDeadlineSchema = z.strictObject({
    type: z.enum(['this_week', 'this_month', 'someday']),
    remindEvery: optionalOrNull(z.enum(['daily', 'weekly'])),
});

export class SetFuzzyDeadlineDto extends createZodDto<ISetFuzzyDeadlineDto>({
    schema: setFuzzyDeadlineSchema,
    name: 'SetFuzzyDeadlineDto',
}) {}
