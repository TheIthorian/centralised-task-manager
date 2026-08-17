import type { ToolRegistry } from '../protocol/tool-registry.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

const channelPrefsSchema = z.object({
    inApp: z.boolean().optional(),
    discord: z.boolean().optional(),
    email: z.boolean().optional(),
});

/** Register all notification-related MCP tools on the given registry. */
export function registerNotificationTools({ registry, client }: { registry: ToolRegistry; client: CtmApiClient }): void {
    registry.registerTool(
        'list_notifications',
        {
            description: 'List in-app notifications. Optionally filter to unread only.',
            inputSchema: {
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(100).default(20),
                unreadOnly: z.boolean().default(false),
            },
            annotations: { readOnlyHint: true },
        },
        async ({ page, limit, unreadOnly }) => {
            const notifications = await client.listNotifications({ page, limit, unreadOnly });
            return { content: [{ type: 'text' as const, text: JSON.stringify(notifications) }] };
        },
    );

    registry.registerTool(
        'mark_notification_read',
        {
            description: 'Mark a single notification as read by ID.',
            inputSchema: { id: z.string().min(1) },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ id }) => {
            const result = await client.markNotificationRead({ id });
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        },
    );

    registry.registerTool(
        'mark_all_notifications_read',
        {
            description: 'Mark all notifications as read for the current user.',
            inputSchema: {},
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async () => {
            const result = await client.markAllNotificationsRead();
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        },
    );

    registry.registerTool(
        'get_notification_preferences',
        {
            description: 'Get notification preferences (per trigger and channel) for the current user.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const prefs = await client.getNotificationPreferences();
            return { content: [{ type: 'text' as const, text: JSON.stringify(prefs) }] };
        },
    );

    registry.registerTool(
        'update_notification_preferences',
        {
            description: 'Update notification preferences. Only provided fields are changed.',
            inputSchema: {
                connectorReconnect: channelPrefsSchema.optional(),
                dailySummary: channelPrefsSchema.optional(),
                reminder: channelPrefsSchema.optional(),
                upcomingDeadline: channelPrefsSchema.optional(),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ connectorReconnect, dailySummary, reminder, upcomingDeadline }) => {
            const prefs = await client.updateNotificationPreferences({
                dto: { connectorReconnect, dailySummary, reminder, upcomingDeadline },
            });
            return { content: [{ type: 'text' as const, text: JSON.stringify(prefs) }] };
        },
    );

    registry.registerTool(
        'get_discord_status',
        {
            description: 'Get Discord connection status for the current user.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const status = await client.getDiscordStatus();
            return { content: [{ type: 'text' as const, text: JSON.stringify(status) }] };
        },
    );

    registry.registerTool(
        'disconnect_discord',
        {
            description: 'Disconnect Discord from the current user account.',
            inputSchema: {},
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async () => {
            await client.disconnectDiscord();
            return { content: [{ type: 'text' as const, text: 'Discord disconnected.' }] };
        },
    );

    registry.registerTool(
        'get_discord_connect_url',
        {
            description:
                'Get the Discord OAuth connect URL for linking a Discord account. Return this URL to the user so they can open it.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const url = await client.getDiscordConnectUrl();
            return { content: [{ type: 'text' as const, text: url }] };
        },
    );

    registry.registerTool(
        'test_notification_channel',
        {
            description: 'Send a test notification via a channel to verify it is working (e.g. "discord", "email").',
            inputSchema: { channel: z.string().min(1) },
            annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ channel }) => {
            const result = await client.testNotificationChannel({ channel });
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        },
    );
}
