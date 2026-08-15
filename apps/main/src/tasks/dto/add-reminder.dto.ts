import type { AddReminderDto as IAddReminderDto } from '@ctm/api-client';
import { createZodDto, isoDateTimeSchema, requestObject } from '@ctm/nest-common';

export const addReminderSchema = requestObject({
    remindAt: isoDateTimeSchema.describe('ISO 8601 datetime for the reminder'),
});

export class AddReminderDto extends createZodDto<IAddReminderDto>({
    schema: addReminderSchema,
    name: 'AddReminderDto',
}) {}
