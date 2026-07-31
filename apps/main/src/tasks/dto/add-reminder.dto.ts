import type { AddReminderDto as IAddReminderDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema, requestObject } from '../../common/zod/param-schemas.js';

export const addReminderSchema = requestObject({
    remindAt: isoDateTimeSchema.describe('ISO 8601 datetime for the reminder'),
});

export class AddReminderDto extends createZodDto<IAddReminderDto>({
    schema: addReminderSchema,
    name: 'AddReminderDto',
}) {}
