import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscordConnection, type DiscordConnectionDocument } from '../../connectors/schemas/discord-connection.schema.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordAuthExpiredError extends Error {
    constructor() {
        super('Discord bot token is invalid');
        this.name = 'DiscordAuthExpiredError';
    }
}

@Injectable()
export class DiscordChannel {
    private readonly logger = new Logger(DiscordChannel.name);
    private readonly botToken: string;

    constructor(
        @InjectModel(DiscordConnection.name) private readonly model: Model<DiscordConnectionDocument>,
        config: ConfigService,
    ) {
        this.botToken = config.getOrThrow<string>('DISCORD_BOT_TOKEN');
    }

    /** Send a DM via Discord bot. No-op if the user has no DiscordConnection. */
    async send({ userId, title, body }: SendNotificationDto): Promise<void> {
        const connection = await this.model.findOne({ userId: new Types.ObjectId(userId) });

        if (!connection) return;

        const channelId = connection.dmChannelId ?? (await this.openDmChannel(connection));

        await this.sendMessage({ channelId, content: `**${title}**\n${body}`, connection });
    }

    private async openDmChannel(connection: DiscordConnectionDocument): Promise<string> {
        const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: 'POST',
            headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: connection.discordUserId }),
        });

        if (res.status === 401) throw new DiscordAuthExpiredError();

        if (!res.ok) throw new Error(`Discord open DM failed: ${res.status}`);

        const data = (await res.json()) as { id: string };

        await this.model.findByIdAndUpdate(connection._id, { dmChannelId: data.id });

        return data.id;
    }

    private async sendMessage({
        channelId,
        content,
        connection,
    }: {
        channelId: string;
        content: string;
        connection: DiscordConnectionDocument;
    }): Promise<void> {
        const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${this.botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });

        if (res.status === 401) {
            this.logger.warn(`Discord bot token invalid — removing connection for userId=${String(connection.userId)}`);
            await this.model.deleteOne({ _id: connection._id });
            throw new DiscordAuthExpiredError();
        }

        if (!res.ok) throw new Error(`Discord send message failed: ${res.status}`);
    }
}
