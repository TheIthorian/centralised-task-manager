import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DiscordMessageClient } from '@ctm/connectors';
import { DiscordChannel } from './discord.channel.js';
import { ConnectorConfig } from '../../connectors/schemas/connector-config.schema.js';
import type { TypedConnectorConfig } from '../../connectors/schemas/connector-config.schema.js';

function makeDiscordConfig(overrides?: Partial<{ dmChannelId: string | null }>): TypedConnectorConfig {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        source: 'discord',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: new Date(),
        settings: { discordUserId: 'discord-user-1' },
        internalSettings: { botToken: 'bot-token', dmChannelId: overrides && 'dmChannelId' in overrides ? overrides.dmChannelId : 'chan-99' },
        enabled: true,
        lastSyncedAt: null,
        lastError: null,
    } as unknown as TypedConnectorConfig;
}

describe('DiscordChannel (NestJS wrapper)', () => {
    let channel: DiscordChannel;
    let mockFindOne: ReturnType<typeof vi.fn>;
    let mockFindByIdAndUpdate: ReturnType<typeof vi.fn>;
    let mockDiscordMessageClient: {
        send: ReturnType<typeof vi.fn>;
        openDmChannel: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockFindOne = vi.fn();
        mockFindByIdAndUpdate = vi.fn().mockResolvedValue({});
        mockDiscordMessageClient = {
            send: vi.fn(),
            openDmChannel: vi.fn(),
        };

        const module = await Test.createTestingModule({
            providers: [
                DiscordChannel,
                {
                    provide: getModelToken(ConnectorConfig.name),
                    useValue: { findOne: mockFindOne, findByIdAndUpdate: mockFindByIdAndUpdate },
                },
                {
                    provide: DiscordMessageClient,
                    useValue: mockDiscordMessageClient,
                },
            ],
        }).compile();

        channel = module.get(DiscordChannel);
    });

    it('is a no-op when user has no discord ConnectorConfig', async () => {
        mockFindOne.mockResolvedValue(null);
        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });
        expect(mockDiscordMessageClient.send).not.toHaveBeenCalled();
        expect(mockDiscordMessageClient.openDmChannel).not.toHaveBeenCalled();
    });

    it('sends a message to the cached dmChannelId', async () => {
        mockFindOne.mockResolvedValue(makeDiscordConfig({ dmChannelId: 'chan-99' }));
        mockDiscordMessageClient.send.mockResolvedValue(undefined);

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'Hi', body: 'Go!' });

        expect(mockDiscordMessageClient.send).toHaveBeenCalledWith({
            channelId: 'chan-99',
            botToken: 'bot-token',
            title: 'Hi',
            body: 'Go!',
        });
    });

    it('opens a DM channel and persists dmChannelId when null', async () => {
        const config = makeDiscordConfig({ dmChannelId: null });
        mockFindOne.mockResolvedValue(config);
        mockDiscordMessageClient.openDmChannel.mockResolvedValue({ id: 'new-chan', type: 1 });
        mockDiscordMessageClient.send.mockResolvedValue(undefined);

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });

        expect(mockDiscordMessageClient.openDmChannel).toHaveBeenCalledWith({
            botToken: 'bot-token',
            discordUserId: 'discord-user-1',
        });
        expect(mockDiscordMessageClient.send).toHaveBeenCalledWith({
            channelId: 'new-chan',
            botToken: 'bot-token',
            title: 'T',
            body: 'B',
        });
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
            config._id,
            { 'internalSettings.dmChannelId': 'new-chan' },
        );
    });
});
