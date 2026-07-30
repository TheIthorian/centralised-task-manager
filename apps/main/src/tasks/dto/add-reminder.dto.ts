import { z } from 'zod';
import type { AddReminderDto as IAddReminderDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { isoDateTimeSchema } from '../../common/zod/param-schemas.js';

export const addReminderSchema = z.strictObject({
    remindAt: isoDateTimeSchema.describe('ISO 8601 datetime for the reminder'),
});

export class AddReminderDto extends createZodDto<IAddReminderDto>({
    schema: addReminderSchema,
    name: 'AddReminderDto',
}) {}
