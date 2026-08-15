import { Injectable, NotFoundException } from '@nestjs/common';
import { appLogger } from '../logging/app-logger.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, type NotificationDocument, User, type UserDocument } from '@ctm/db';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
import type { SendNotificationDto, NotificationType } from './dto/send-notification.dto.js';
import type { MarkAllReadResultDto, MarkReadResultDto, NotificationDto } from '@ctm/api-client';

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
    private readonly logger = appLogger(NotificationsService.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
        private readonly inApp: InAppChannel,
        private readonly email: EmailChannel,
        private readonly discord: DiscordChannel,
    ) {}

    // ── Inbox ──────────────────────────────────────────────────────────────────

    /** List in-app notifications for the given user, newest first. */
    async list({
        userId,
        page = 1,
        limit = 20,
        unreadOnly = false,
    }: {
        userId: string;
        page?: number;
        limit?: number;
        unreadOnly?: boolean;
    }): Promise<NotificationDto[]> {
        const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

        if (unreadOnly) filter['read'] = false;

        const docs = await this.notificationModel
            .find(filter)
            .select('type data title body read createdAt')
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        return docs.map((d) => ({
            id: String(d._id),
            type: d.type,
            data: d.data ?? { type: d.type },
            title: d.title,
            body: d.body,
            read: d.read,
            createdAt: d.createdAt?.toISOString() ?? new Date(0).toISOString(),
        }));
    }

    /** Mark a single notification as read and return its updated state. */
    async markRead({ userId, id }: { userId: string; id: string }): Promise<MarkReadResultDto> {
        const doc = await this.notificationModel.findOneAndUpdate(
            { _id: id, userId: new Types.ObjectId(userId) },
            { read: true },
            { new: true },
        );

        if (!doc) throw new NotFoundException('Notification not found');

        return { id: String(doc._id), read: doc.read };
    }

    /** Mark all notifications for the given user as read. */
    async markAllRead({ userId }: { userId: string }): Promise<MarkAllReadResultDto> {
        const result = await this.notificationModel.updateMany(
            { userId: new Types.ObjectId(userId), read: false },
            { read: true },
        );

        return { updated: result.modifiedCount };
    }

    /** Send a test notification directly to the specified channel, bypassing user preferences. */
    async testChannel({ userId, channel }: { userId: string; channel: Channel }): Promise<{ sent: boolean }> {
        const message = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)]!;

        const dto: SendNotificationDto = {
            userId,
            type: 'reminder',
            data: { type: 'reminder' },
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
                } catch (reconnectErr) {
                    this.logger.error(
                        { err: reconnectErr, userId: dto.userId, channel },
                        'Failed to notify the user that Discord needs reconnecting',
                    );
                }

                return;
            }

            this.logger.error({ err, userId: dto.userId, channel, type: dto.type }, 'Notification delivery failed');
        }
    }
}
