import type { UpdateUserDto as IUpdateUserDto } from '@ctm/api-client';
import { createZodDto, emailSchema, passwordSchema, requestObject } from '@ctm/nest-common';

export const updateUserSchema = requestObject({
    email: emailSchema.optional(),
    currentPassword: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
});

export class UpdateUserDto extends createZodDto<IUpdateUserDto>({
    schema: updateUserSchema,
    name: 'UpdateUserDto',
}) {}
