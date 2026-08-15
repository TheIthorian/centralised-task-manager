import { z } from 'zod';
import type { UpdateNotificationPreferencesDto as IUpdateNotificationPreferencesDto } from '@ctm/api-client';
import { createZodDto, requestObject } from '@ctm/nest-common';

export const channelPrefsSchema = requestObject({
    inApp: z.boolean().optional(),
    discord: z.boolean().optional(),
    email: z.boolean().optional(),
});

export const updatePreferencesSchema = requestObject({
    connectorReconnect: channelPrefsSchema.optional(),
    dailySummary: channelPrefsSchema.optional(),
    reminder: channelPrefsSchema.optional(),
    upcomingDeadline: channelPrefsSchema.optional(),
});

export class UpdatePreferencesDto extends createZodDto<IUpdateNotificationPreferencesDto>({
    schema: updatePreferencesSchema,
    name: 'UpdatePreferencesDto',
}) {}
