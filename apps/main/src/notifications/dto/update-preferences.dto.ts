import { z } from 'zod';
import type { UpdateNotificationPreferencesDto as IUpdateNotificationPreferencesDto } from '@ctm/api-client';
import { createZodDto } from '../../common/zod/create-zod-dto.js';
import { optionalOrNull } from '../../common/zod/param-schemas.js';

export const channelPrefsSchema = z.strictObject({
    inApp: optionalOrNull(z.boolean()),
    discord: optionalOrNull(z.boolean()),
    email: optionalOrNull(z.boolean()),
});

export const updatePreferencesSchema = z.strictObject({
    connectorReconnect: optionalOrNull(channelPrefsSchema),
    dailySummary: optionalOrNull(channelPrefsSchema),
    reminder: optionalOrNull(channelPrefsSchema),
    upcomingDeadline: optionalOrNull(channelPrefsSchema),
});

export class UpdatePreferencesDto extends createZodDto<IUpdateNotificationPreferencesDto>({
    schema: updatePreferencesSchema,
    name: 'UpdatePreferencesDto',
}) {}
