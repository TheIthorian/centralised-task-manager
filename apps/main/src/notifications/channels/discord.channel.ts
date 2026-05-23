import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscordChannel as DiscordChannelConnector } from '@ctm/connectors';
import {
    ConnectorConfig,
    type ConnectorConfigDocument,
    type TypedConnectorConfig,
} from '../../connectors/schemas/connector-config.schema.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

const connector = new DiscordChannelConnector();

/** Thrown when the Discord connection/bot token is expired or unauthorized. */
export class DiscordAuthExpiredError extends Error {
    constructor() {
        super('Discord token expired or unauthorized');
        this.name = 'DiscordAuthExpiredError';
    }
}

@Injectable()
export class DiscordChannel {
    constructor(@InjectModel(ConnectorConfig.name) private readonly model: Model<ConnectorConfigDocument>) {}

    /** Send a DM via Discord bot. No-op if the user has no discord ConnectorConfig. */
    async send({ userId, title, body }: SendNotificationDto): Promise<void> {
        const config = await this.model.findOne({ userId: new Types.ObjectId(userId), source: 'discord' });

        if (!config) return;

        const typed = config as unknown as TypedConnectorConfig & { source: 'discord' };
        const { discordUserId } = typed.settings;
        const { botToken, dmChannelId } = typed.internalSettings;

        try {
            if (!dmChannelId) {
                const openedChannelId = await connector.openDmChannel({ botToken, discordUserId });

                await this.model.findOneAndUpdate(
                    { userId: new Types.ObjectId(userId), source: 'discord' },
                    { 'internalSettings.dmChannelId': openedChannelId },
                );

                await connector.send({
                    config: { discordUserId, botToken, dmChannelId: openedChannelId },
                    title,
                    body,
                });

                return;
            }

            await connector.send({ config: { discordUserId, botToken, dmChannelId }, title, body });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('401') || msg.includes('Unauthorized')) {
                throw new DiscordAuthExpiredError();
            }

            throw err;
        }
    }
}
