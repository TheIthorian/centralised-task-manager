import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema, optionalOrNull, queryBooleanSchema } from '../../common/zod/param-schemas.js';

export const MAX_PAGE_SIZE = 500;

export const listTasksQuerySchema = z.strictObject({
    filter: optionalOrNull(z.enum(['all', 'today', 'upcoming', 'done'])).describe(
        'UI-level preset filter — maps to date and status constraints in the service.',
    ),
    status: optionalOrNull(z.enum(['open', 'done', 'archived'])),
    source: optionalOrNull(z.string().min(1).max(50)),
    fuzzy: optionalOrNull(z.enum(['this_week', 'this_month', 'someday'])),
    surfaced: optionalOrNull(queryBooleanSchema),
    lastUpdatedFromDate: optionalOrNull(isoDateTimeSchema).describe('Only return tasks updated on or after this date.'),
    dueBefore: optionalOrNull(isoDateTimeSchema).describe(
        'Only tasks where due.date < dueBefore. Must not be combined with the `filter` preset.',
    ),
    dueAfter: optionalOrNull(isoDateTimeSchema).describe('Only tasks where due.date >= dueAfter.'),
    noDate: optionalOrNull(queryBooleanSchema).describe('When true, only return tasks with no due date.'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export class ListTasksQueryDto extends createZodDto({
    schema: listTasksQuerySchema,
    name: 'ListTasksQueryDto',
}) {}
