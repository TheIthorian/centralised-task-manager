import { z } from 'zod';
import type { SetTaskStatusDto as ISetTaskStatusDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { requestObject } from '../../common/zod/param-schemas.js';

export const setTaskStatusSchema = requestObject({
    status: z.enum(['open', 'done']).describe('Target status for the task.'),
});

export class SetTaskStatusDto extends createZodDto<ISetTaskStatusDto>({
    schema: setTaskStatusSchema,
    name: 'SetTaskStatusDto',
}) {}
