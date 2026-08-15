import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { DiscordMessageClient } from '@ctm/connectors';
import { DiscordChannel } from './discord.channel.js';
import { ConnectorConfig, ConnectorConfigSchema, type ConnectorConfigDocument } from '@ctm/db';

describe('DiscordChannel (NestJS wrapper)', () => {
    let module: TestingModule;
    let channel: DiscordChannel;
    let connectorModel: Model<ConnectorConfigDocument>;
    let mockDiscordMessageClient: {
        send: ReturnType<typeof vi.fn>;
        openDmChannel: ReturnType<typeof vi.fn>;
    };

    beforeAll(async () => {
        mockDiscordMessageClient = {
            send: vi.fn(),
            openDmChannel: vi.fn(),
        };

        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: ConnectorConfig.name, schema: ConnectorConfigSchema }]),
            ],
            providers: [DiscordChannel, { provide: DiscordMessageClient, useValue: mockDiscordMessageClient }],
        }).compile();

        channel = module.get(DiscordChannel);
        connectorModel = module.get<Model<ConnectorConfigDocument>>(getModelToken(ConnectorConfig.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('is a no-op when user has no discord ConnectorConfig', async () => {
        vi.clearAllMocks();
        const userId = new Types.ObjectId().toHexString();

        await channel.send({ userId, type: 'reminder', title: 'T', body: 'B' });

        expect(mockDiscordMessageClient.send).not.toHaveBeenCalled();
        expect(mockDiscordMessageClient.openDmChannel).not.toHaveBeenCalled();
    });

    it('sends a message to the cached dmChannelId', async () => {
        vi.clearAllMocks();
        mockDiscordMessageClient.send.mockResolvedValue(undefined);
        const userId = new Types.ObjectId();
        await connectorModel.create({
            userId,
            source: 'discord',
            accessToken: 'stub-token',
            tokenExpiresAt: new Date(),
            settings: { discordUserId: 'discord-user-1', botToken: 'bot-token', dmChannelId: 'chan-99' },
            enabled: true,
        });

        await channel.send({ userId: userId.toHexString(), type: 'reminder', title: 'Hi', body: 'Go!' });

        expect(mockDiscordMessageClient.send).toHaveBeenCalledWith({
            channelId: 'chan-99',
            botToken: 'bot-token',
            title: 'Hi',
            body: 'Go!',
        });
    });

    it('opens a DM channel and persists dmChannelId when null', async () => {
        vi.clearAllMocks();
        mockDiscordMessageClient.openDmChannel.mockResolvedValue({ id: 'new-chan', type: 1 });
        mockDiscordMessageClient.send.mockResolvedValue(undefined);
        const userId = new Types.ObjectId();
        const config = await connectorModel.create({
            userId,
            source: 'discord',
            accessToken: 'stub-token',
            tokenExpiresAt: new Date(),
            settings: { discordUserId: 'discord-user-2', botToken: 'bot-token-2', dmChannelId: null },
            enabled: true,
        });

        await channel.send({ userId: userId.toHexString(), type: 'reminder', title: 'T', body: 'B' });

        expect(mockDiscordMessageClient.openDmChannel).toHaveBeenCalledWith({
            botToken: 'bot-token-2',
            discordUserId: 'discord-user-2',
        });
        expect(mockDiscordMessageClient.send).toHaveBeenCalledWith({
            channelId: 'new-chan',
            botToken: 'bot-token-2',
            title: 'T',
            body: 'B',
        });

        const updated = await connectorModel.findById(config._id);

        expect(updated?.settings.dmChannelId).toBe('new-chan');
    });
});
