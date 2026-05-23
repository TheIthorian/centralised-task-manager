import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
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
    let mockFindOneAndUpdate: ReturnType<typeof vi.fn>;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockFindOne = vi.fn();
        mockFindOneAndUpdate = vi.fn().mockResolvedValue({});
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        const module = await Test.createTestingModule({
            providers: [
                DiscordChannel,
                {
                    provide: getModelToken(ConnectorConfig.name),
                    useValue: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate },
                },
            ],
        }).compile();

        channel = module.get(DiscordChannel);
    });

    it('is a no-op when user has no discord ConnectorConfig', async () => {
        mockFindOne.mockResolvedValue(null);
        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends a message to the cached dmChannelId', async () => {
        mockFindOne.mockResolvedValue(makeDiscordConfig({ dmChannelId: 'chan-99' }));
        fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'Hi', body: 'Go!' });

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe('https://discord.com/api/v10/channels/chan-99/messages');
    });

    it('opens a DM channel and persists dmChannelId when null', async () => {
        mockFindOne.mockResolvedValue(makeDiscordConfig({ dmChannelId: null }));
        fetchSpy
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-chan', type: 1 }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ source: 'discord' }),
            { 'internalSettings.dmChannelId': 'new-chan' },
        );
    });
});
