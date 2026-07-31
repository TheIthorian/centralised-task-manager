import { z } from 'zod';
import type { RegisterDto as IRegisterDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, passwordSchema, requestObject } from '../../common/zod/param-schemas.js';

export const registerSchema = requestObject({
    name: z.string().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
});

export class RegisterDto extends createZodDto<IRegisterDto>({ schema: registerSchema, name: 'RegisterDto' }) {}
