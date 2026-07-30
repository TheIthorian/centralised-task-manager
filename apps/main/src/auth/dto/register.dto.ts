import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, passwordSchema } from '../../common/zod/param-schemas.js';

export const registerSchema = z.strictObject({
    name: z.string().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
});

export class RegisterDto extends createZodDto({ schema: registerSchema, name: 'RegisterDto' }) {}
