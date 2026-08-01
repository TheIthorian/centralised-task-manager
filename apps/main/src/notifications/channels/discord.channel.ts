import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorConfig } from '../../connectors/schemas/connector-config.schema.js';
import { DiscordConnectorConfig } from '../../connectors/schemas/types.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';
import { ConnectorName, DiscordMessageClient } from '@ctm/connectors';
import { createLogger } from '@ctm/logger';

/** Thrown when the Discord connection/bot token is expired or unauthorized. */
export class DiscordAuthExpiredError extends Error {
    constructor() {
        super('Discord token expired or unauthorized');
        this.name = 'DiscordAuthExpiredError';
    }
}

@Injectable()
export class DiscordChannel {
    private readonly logger = createLogger(DiscordChannel.name);

    constructor(
        @InjectModel(ConnectorConfig.name) private readonly model: Model<ConnectorConfig<DiscordConnectorConfig>>,
        private readonly discordMessageClient: DiscordMessageClient,
    ) {}

    /** Send a DM via Discord bot. No-op if the user has no discord ConnectorConfig. */
    async send({ userId, title, body }: SendNotificationDto): Promise<void> {
        const config = await this.model.findOne({ userId: new Types.ObjectId(userId), source: ConnectorName.Discord });

        if (!config) return;

        const { discordUserId, botToken, dmChannelId } = config.settings;
        let channelId = dmChannelId;

        try {
            if (!channelId) {
                const { id: openedChannelId } = await this.discordMessageClient.openDmChannel({
                    botToken,
                    discordUserId,
                });

                await this.model.findByIdAndUpdate(config._id, { 'settings.dmChannelId': openedChannelId });

                channelId = openedChannelId;
            }

            await this.discordMessageClient.send({ channelId, botToken, title, body });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);

            if (msg.includes('401') || msg.includes('Unauthorized')) {
                this.logger.warn({ err, userId }, 'Discord connection is no longer authorized');

                throw new DiscordAuthExpiredError();
            }

            this.logger.error({ err, userId }, 'Discord message send failed');

            throw err;
        }
    }
}
