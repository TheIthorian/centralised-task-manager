import { z } from 'zod';
import type { TaskRelationDto as ITaskRelationDto } from '@ctm/api-client';
import { createZodDto, objectIdSchema, requestObject } from '@ctm/nest-common';

export const RELATION_TYPES = ['parent', 'child', 'next', 'previous', 'related'] as const;

/** Request body for adding or removing a relation between two tasks. */
export const taskRelationSchema = requestObject({
    type: z.enum(RELATION_TYPES),
    targetTaskId: objectIdSchema.describe('CTM task ObjectId of the related task'),
});

export class TaskRelationDto extends createZodDto<ITaskRelationDto>({
    schema: taskRelationSchema,
    name: 'TaskRelationDto',
}) {}
