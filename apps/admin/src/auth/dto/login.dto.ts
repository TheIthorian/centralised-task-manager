import { z } from 'zod';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const adminLoginSchema = requestObject({
    username: z.string().min(1).max(200),
    password: z.string().min(1).max(255),
});

export class AdminLoginDto extends createZodDto<z.infer<typeof adminLoginSchema>>({
    schema: adminLoginSchema,
    name: 'AdminLoginDto',
}) {}
