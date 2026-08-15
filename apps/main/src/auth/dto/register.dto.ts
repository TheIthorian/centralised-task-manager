import { z } from 'zod';
import type { RegisterDto as IRegisterDto } from '@ctm/api-client';
import { createZodDto, emailSchema, passwordSchema, requestObject } from '@ctm/nest-common';

export const registerSchema = requestObject({
    name: z.string().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
});

export class RegisterDto extends createZodDto<IRegisterDto>({ schema: registerSchema, name: 'RegisterDto' }) {}
