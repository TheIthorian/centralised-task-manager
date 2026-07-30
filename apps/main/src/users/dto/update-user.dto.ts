import type { UpdateUserDto as IUpdateUserDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { emailSchema, requestObject, passwordSchema } from '../../common/zod/param-schemas.js';

export const updateUserSchema = requestObject({
    email: emailSchema.optional(),
    currentPassword: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
});

export class UpdateUserDto extends createZodDto<IUpdateUserDto>({
    schema: updateUserSchema,
    name: 'UpdateUserDto',
}) {}
