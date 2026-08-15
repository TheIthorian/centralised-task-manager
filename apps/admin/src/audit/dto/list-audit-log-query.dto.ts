import { z } from 'zod';
import { AuditAction } from '@ctm/db';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const listAuditLogQuerySchema = requestObject({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    skip: z.coerce.number().int().min(0).max(100_000).optional().default(0),
    action: z.enum(AuditAction).optional(),
    targetId: z.string().max(200).optional(),
});

export class ListAuditLogQueryDto extends createZodDto<z.infer<typeof listAuditLogQuerySchema>>({
    schema: listAuditLogQuerySchema,
    name: 'ListAuditLogQueryDto',
}) {}
