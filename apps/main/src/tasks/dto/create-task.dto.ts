import { z } from 'zod';
import type { CreateTaskDto as ICreateTaskDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema, requestObject } from '../../common/zod/param-schemas.js';
import { dueDateSchema, durationSchema, locationsSchema, prioritySchema } from './update-task.dto.js';

export const createTaskSchema = requestObject({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    due: dueDateSchema.optional(),
    deadlineDate: isoDateTimeSchema.optional(),
    duration: durationSchema.optional(),
    priority: prioritySchema.optional(),
    locations: locationsSchema.optional().describe('Locations with Google Maps links'),
    source: z.string().min(1).max(50).describe('Connector source to write through to'),
});

export class CreateTaskDto extends createZodDto<ICreateTaskDto>({
    schema: createTaskSchema,
    name: 'CreateTaskDto',
}) {}
