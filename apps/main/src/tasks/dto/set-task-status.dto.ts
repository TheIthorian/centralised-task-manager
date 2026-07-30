import { z } from 'zod';
import type { SetTaskStatusDto as ISetTaskStatusDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';

export const setTaskStatusSchema = z.strictObject({
    status: z.enum(['open', 'done']).describe('Target status for the task.'),
});

export class SetTaskStatusDto extends createZodDto<ISetTaskStatusDto>({
    schema: setTaskStatusSchema,
    name: 'SetTaskStatusDto',
}) {}
