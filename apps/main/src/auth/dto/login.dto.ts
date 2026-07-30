import { z } from 'zod';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, passwordSchema } from '../../common/zod/param-schemas.js';

export const loginSchema = z.strictObject({
    email: emailSchema,
    password: passwordSchema,
});

export class LoginDto extends createZodDto({ schema: loginSchema, name: 'LoginDto' }) {}
