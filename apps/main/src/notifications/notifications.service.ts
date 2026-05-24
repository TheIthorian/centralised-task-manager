import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
import type { SendNotificationDto, NotificationType } from './dto/send-notification.dto.js';

type TriggerKey = 'connectorReconnect' | 'dailySummary' | 'reminder' | 'upcomingDeadline';

export enum Channel {
    InApp = 'inApp',
    Email = 'email',
    Discord = 'discord',
}

const TEST_MESSAGES = [
    '👋 Hey! Your CTM notifications are working perfectly!',
    "🎉 Connection successful! I'll ping you here when something needs your attention.",
    '✅ All systems go! CTM is ready to send you notifications.',
    "🚀 Discord connected! You're all set to receive task reminders here.",
    '💬 Hello from CTM! Notifications are live and ready to go.',
];

const TRIGGER_KEY_MAP: Record<NotificationType, TriggerKey> = {
    connector_reconnect: 'connectorReconnect',
    daily_summary: 'dailySummary',
    reminder: 'reminder',
    upcoming_deadline: 'upcomingDeadline',
};

type ChannelPrefs = Record<Channel, boolean>;

const DEFAULT_PREFS: ChannelPrefs = { [Channel.InApp]: true, [Channel.Discord]: false, [Channel.Email]: false };

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly inApp: InAppChannel,
        private readonly email: EmailChannel,
        private readonly discord: DiscordChannel,
    ) {}

    /** Send a test notification directly to the specified channel, bypassing user preferences. */
    async testChannel({ userId, channel }: { userId: string; channel: Channel }): Promise<{ sent: boolean }> {
        const message = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)]!;

        const dto: SendNotificationDto = {
            userId,
            type: 'reminder',
            title: 'Test notification',
            body: message,
        };

        await this[channel].send(dto);

        return { sent: true };
    }

    /** Fan out a notification to all channels enabled for this user + trigger combination. */
    async send(dto: SendNotificationDto): Promise<void> {
        const user = await this.userModel.findById(dto.userId).select('notificationPreferences');
        if (!user) return;

        const key = TRIGGER_KEY_MAP[dto.type];
        const prefs = user.notificationPreferences?.[key];
        const channelPrefs: ChannelPrefs = {
            [Channel.InApp]: prefs?.inApp ?? DEFAULT_PREFS[Channel.InApp],
            [Channel.Discord]: prefs?.discord ?? DEFAULT_PREFS[Channel.Discord],
            [Channel.Email]: prefs?.email ?? DEFAULT_PREFS[Channel.Email],
        };

        await Promise.all(
            (Object.entries(channelPrefs) as [Channel, boolean][])
                .filter(([_, enabled]) => enabled)
                .map(([channel]) => this.safeRun(channel, dto)),
        );
    }

    private async safeRun(channel: Channel, dto: SendNotificationDto): Promise<void> {
        try {
            await this[channel].send(dto);
        } catch (err) {
            if (err instanceof DiscordAuthExpiredError) {
                try {
                    await this.inApp.send({
                        ...dto,
                        type: 'connector_reconnect',
                        title: 'Reconnect Discord',
                        body: 'Your Discord connection has expired. Please reconnect.',
                    });
                } catch {
                    // ignore
                }

                return;
            }

            this.logger.warn(`Channel ${channel} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
