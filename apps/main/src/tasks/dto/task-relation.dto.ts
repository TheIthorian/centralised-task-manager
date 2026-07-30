import { z } from 'zod';
import type { TaskRelationDto as ITaskRelationDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { objectIdSchema } from '../../common/zod/param-schemas.js';

export const RELATION_TYPES = ['parent', 'child', 'next', 'previous', 'related'] as const;

/** Request body for adding or removing a relation between two tasks. */
export const taskRelationSchema = z.strictObject({
    type: z.enum(RELATION_TYPES),
    targetTaskId: objectIdSchema.describe('CTM task ObjectId of the related task'),
});

export class TaskRelationDto extends createZodDto<ITaskRelationDto>({
    schema: taskRelationSchema,
    name: 'TaskRelationDto',
}) {}
