import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema, requestObject, queryBooleanSchema } from '../../common/zod/param-schemas.js';

export const MAX_PAGE_SIZE = 500;

export const listTasksQuerySchema = requestObject({
    filter: z
        .enum(['all', 'today', 'upcoming', 'done'])
        .optional()
        .describe('UI-level preset filter — maps to date and status constraints in the service.'),
    status: z.enum(['open', 'done', 'archived']).optional(),
    source: z.string().min(1).max(50).optional(),
    fuzzy: z.enum(['this_week', 'this_month', 'someday']).optional(),
    surfaced: queryBooleanSchema.optional(),
    lastUpdatedFromDate: isoDateTimeSchema.optional().describe('Only return tasks updated on or after this date.'),
    dueBefore: isoDateTimeSchema
        .optional()
        .describe('Only tasks where due.date < dueBefore. Must not be combined with the `filter` preset.'),
    dueAfter: isoDateTimeSchema.optional().describe('Only tasks where due.date >= dueAfter.'),
    noDate: queryBooleanSchema.optional().describe('When true, only return tasks with no due date.'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export class ListTasksQueryDto extends createZodDto({
    schema: listTasksQuerySchema,
    name: 'ListTasksQueryDto',
}) {}
