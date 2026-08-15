import type { LoginDto as ILoginDto } from '@ctm/api-client';
import { createZodDto, emailSchema, passwordSchema, requestObject } from '@ctm/nest-common';

export const loginSchema = requestObject({
    email: emailSchema,
    password: passwordSchema,
});

export class LoginDto extends createZodDto<ILoginDto>({ schema: loginSchema, name: 'LoginDto' }) {}
