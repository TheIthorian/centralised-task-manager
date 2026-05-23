import type { Command } from 'commander';
import { buildClient } from '../client.js';
import { formatJson, formatTable, print } from '../output.js';
import type { NotificationDto } from '@ctm/api-client';

function notificationRow(n: NotificationDto): string[] {
    return [n.id, n.type, n.title, n.read ? 'read' : 'unread', n.createdAt];
}

/** Register all `ctm notifications *` subcommands on the given program. */
export function registerNotificationsCommand(program: Command): void {
    const notifications = program
        .command('notifications')
        .description('Manage notifications and preferences')
        .option('--token <token>', 'API token (overrides stored credentials)')
        .option('--base-url <url>', 'API base URL');

    // ── Inbox ───────────────────────────────────────────────────────────────────

    const inbox = notifications.command('inbox').description('In-app notification inbox');

    inbox
        .command('list')
        .description('List notifications')
        .option('--unread-only', 'Show only unread notifications')
        .option('--page <n>', 'Page number', '1')
        .option('--limit <n>', 'Items per page', '20')
        .option('--json', 'Output as JSON')
        .action(async (opts: { unreadOnly?: boolean; page: string; limit: string; json?: boolean }) => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.listNotifications({
                    page: Number(opts.page),
                    limit: Number(opts.limit),
                    unreadOnly: opts.unreadOnly ?? false,
                });

                if (opts.json) {
                    print(formatJson(result));
                } else {
                    print(formatTable(['ID', 'Type', 'Title', 'Status', 'Created At'], result.map(notificationRow)));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    inbox
        .command('read <id>')
        .description('Mark a notification as read')
        .action(async (id: string) => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.markNotificationRead({ id });
                print(`Notification ${id} marked as read.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    inbox
        .command('read-all')
        .description('Mark all notifications as read')
        .action(async () => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.markAllNotificationsRead();
                print(`${result.updated} notification(s) marked as read.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    // ── Preferences ─────────────────────────────────────────────────────────────

    const prefs = notifications.command('preferences').description('Notification preferences');

    prefs
        .command('get')
        .description('Show notification preferences')
        .action(async () => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.getNotificationPreferences();
                print(formatJson(result));
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    prefs
        .command('set')
        .description('Update notification preferences (e.g. --daily-summary-discord true)')
        .option('--connector-reconnect-in-app <bool>')
        .option('--connector-reconnect-discord <bool>')
        .option('--connector-reconnect-email <bool>')
        .option('--daily-summary-in-app <bool>')
        .option('--daily-summary-discord <bool>')
        .option('--daily-summary-email <bool>')
        .option('--reminder-in-app <bool>')
        .option('--reminder-discord <bool>')
        .option('--reminder-email <bool>')
        .option('--upcoming-deadline-in-app <bool>')
        .option('--upcoming-deadline-discord <bool>')
        .option('--upcoming-deadline-email <bool>')
        .action(
            async (opts: Record<string, string | undefined>) => {
                const parent = notifications.opts<{ token?: string; baseUrl?: string }>();

                const parseBool = (v: string | undefined): boolean | undefined =>
                    v === undefined ? undefined : v === 'true';

                try {
                    const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                    const result = await client.updateNotificationPreferences({
                        dto: {
                            connectorReconnect: {
                                inApp: parseBool(opts['connectorReconnectInApp']),
                                discord: parseBool(opts['connectorReconnectDiscord']),
                                email: parseBool(opts['connectorReconnectEmail']),
                            },
                            dailySummary: {
                                inApp: parseBool(opts['dailySummaryInApp']),
                                discord: parseBool(opts['dailySummaryDiscord']),
                                email: parseBool(opts['dailySummaryEmail']),
                            },
                            reminder: {
                                inApp: parseBool(opts['reminderInApp']),
                                discord: parseBool(opts['reminderDiscord']),
                                email: parseBool(opts['reminderEmail']),
                            },
                            upcomingDeadline: {
                                inApp: parseBool(opts['upcomingDeadlineInApp']),
                                discord: parseBool(opts['upcomingDeadlineDiscord']),
                                email: parseBool(opts['upcomingDeadlineEmail']),
                            },
                        },
                    });
                    print(formatJson(result));
                } catch (err: unknown) {
                    console.error(err instanceof Error ? err.message : String(err));
                    process.exit(1);
                }
            },
        );

    // ── Discord ──────────────────────────────────────────────────────────────────

    const discord = notifications.command('discord').description('Discord notification integration');

    discord
        .command('status')
        .description('Show Discord connection status')
        .action(async () => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const status = await client.getDiscordStatus();
                if (status.connected) {
                    print(`Connected (Discord user: ${status.discordUserId ?? 'unknown'})`);
                } else {
                    print('Not connected');
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    discord
        .command('disconnect')
        .description('Disconnect Discord')
        .action(async () => {
            const parent = notifications.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.disconnectDiscord();
                print('Discord disconnected.');
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });
}
