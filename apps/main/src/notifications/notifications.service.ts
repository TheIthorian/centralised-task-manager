import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
import type { SendNotificationDto, NotificationType } from './dto/send-notification.dto.js';

type TriggerKey = 'connectorReconnect' | 'dailySummary' | 'reminder' | 'upcomingDeadline';

const TRIGGER_KEY_MAP: Record<NotificationType, TriggerKey> = {
    connector_reconnect: 'connectorReconnect',
    daily_summary: 'dailySummary',
    reminder: 'reminder',
    upcoming_deadline: 'upcomingDeadline',
};

type ChannelPrefs = { inApp: boolean; discord: boolean; email: boolean };

const DEFAULT_PREFS: ChannelPrefs = { inApp: true, discord: false, email: false };

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly inApp: InAppChannel,
        private readonly email: EmailChannel,
        private readonly discord: DiscordChannel,
    ) {}

    /** Fan out a notification to all channels enabled for this user + trigger combination. */
    async send(dto: SendNotificationDto): Promise<void> {
        const user = await this.userModel.findById(dto.userId).select('notificationPreferences');

        if (!user) return;

        const key = TRIGGER_KEY_MAP[dto.type];
        const channelPrefs: ChannelPrefs = user.notificationPreferences?.[key] ?? DEFAULT_PREFS;

        if (channelPrefs.inApp) {
            await this.safeRun('inApp', () => this.inApp.send(dto));
        }

        if (channelPrefs.email) {
            await this.safeRun('email', () => this.email.send(dto));
        }

        if (channelPrefs.discord) {
            await this.safeRun('discord', () => this.sendDiscord(dto));
        }
    }

    private async sendDiscord(dto: SendNotificationDto): Promise<void> {
        try {
            await this.discord.send(dto);
        } catch (err) {
            if (err instanceof DiscordAuthExpiredError) {
                this.logger.warn(`Discord auth expired for userId=${dto.userId} — sending reconnect notification`);
                await this.inApp.send({
                    userId: dto.userId,
                    type: 'connector_reconnect',
                    title: 'Reconnect Discord',
                    body: 'Your Discord connection has expired. Please reconnect in Settings to continue receiving Discord notifications.',
                });
                return;
            }

            throw err;
        }
    }

    private async safeRun(channel: string, fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
        } catch (err) {
            this.logger.warn(`Channel ${channel} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
