import { z } from 'zod';
import type { SetFuzzyDeadlineDto as ISetFuzzyDeadlineDto } from '@ctm/api-client';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const setFuzzyDeadlineSchema = requestObject({
    type: z.enum(['this_week', 'this_month', 'someday']),
    remindEvery: z.enum(['daily', 'weekly']).optional(),
});

export class SetFuzzyDeadlineDto extends createZodDto<ISetFuzzyDeadlineDto>({
    schema: setFuzzyDeadlineSchema,
    name: 'SetFuzzyDeadlineDto',
}) {}
