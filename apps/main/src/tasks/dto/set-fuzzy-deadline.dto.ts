import { z } from 'zod';
import type { SetFuzzyDeadlineDto as ISetFuzzyDeadlineDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { requestObject } from '../../common/zod/param-schemas.js';

export const setFuzzyDeadlineSchema = requestObject({
    type: z.enum(['this_week', 'this_month', 'someday']),
    remindEvery: z.enum(['daily', 'weekly']).optional(),
});

export class SetFuzzyDeadlineDto extends createZodDto<ISetFuzzyDeadlineDto>({
    schema: setFuzzyDeadlineSchema,
    name: 'SetFuzzyDeadlineDto',
}) {}
