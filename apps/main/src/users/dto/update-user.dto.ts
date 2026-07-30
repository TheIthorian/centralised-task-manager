import { z } from 'zod';
import type { UpdateUserDto as IUpdateUserDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, optionalOrNull, passwordSchema } from '../../common/zod/param-schemas.js';

export const updateUserSchema = z.strictObject({
    email: optionalOrNull(emailSchema),
    currentPassword: optionalOrNull(passwordSchema),
    newPassword: optionalOrNull(passwordSchema),
});

export class UpdateUserDto extends createZodDto<IUpdateUserDto>({
    schema: updateUserSchema,
    name: 'UpdateUserDto',
}) {}
