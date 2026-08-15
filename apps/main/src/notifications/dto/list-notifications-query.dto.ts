import { z } from 'zod';
import { createZodDto, queryBooleanSchema, requestObject } from '@ctm/nest-common';

/** Validated query parameters for listing in-app notifications. */
export const listNotificationsQuerySchema = requestObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: queryBooleanSchema.default(false),
});

export class ListNotificationsQueryDto extends createZodDto({
    schema: listNotificationsQuerySchema,
    name: 'ListNotificationsQueryDto',
}) {}
