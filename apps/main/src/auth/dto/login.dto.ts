import type { LoginDto as ILoginDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, passwordSchema, requestObject } from '../../common/zod/param-schemas.js';

export const loginSchema = requestObject({
    email: emailSchema,
    password: passwordSchema,
});

export class LoginDto extends createZodDto<ILoginDto>({ schema: loginSchema, name: 'LoginDto' }) {}
