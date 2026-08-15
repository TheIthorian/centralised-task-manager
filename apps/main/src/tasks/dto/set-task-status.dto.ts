import { z } from 'zod';
import type { SetTaskStatusDto as ISetTaskStatusDto } from '@ctm/api-client';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const setTaskStatusSchema = requestObject({
    status: z.enum(['open', 'done']).describe('Target status for the task.'),
});

export class SetTaskStatusDto extends createZodDto<ISetTaskStatusDto>({
    schema: setTaskStatusSchema,
    name: 'SetTaskStatusDto',
}) {}
