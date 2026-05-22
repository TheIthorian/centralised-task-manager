import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { DiscordChannel, DiscordAuthExpiredError } from './discord.channel.js';
import { DiscordConnection } from '../schemas/discord-connection.schema.js';

function makeConfig(): ConfigService {
    return { getOrThrow: () => 'test-token' } as unknown as ConfigService;
}

describe('DiscordChannel', () => {
    let channel: DiscordChannel;
    let mockFindOne: ReturnType<typeof vi.fn>;
    let mockFindByIdAndUpdate: ReturnType<typeof vi.fn>;
    let mockDeleteOne: ReturnType<typeof vi.fn>;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockFindOne = vi.fn();
        mockFindByIdAndUpdate = vi.fn().mockResolvedValue({});
        mockDeleteOne = vi.fn().mockResolvedValue({});
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        const module = await Test.createTestingModule({
            providers: [
                DiscordChannel,
                { provide: ConfigService, useValue: makeConfig() },
                {
                    provide: getModelToken(DiscordConnection.name),
                    useValue: { findOne: mockFindOne, findByIdAndUpdate: mockFindByIdAndUpdate, deleteOne: mockDeleteOne },
                },
            ],
        }).compile();

        channel = module.get(DiscordChannel);
    });

    it('is a no-op when user has no DiscordConnection', async () => {
        mockFindOne.mockResolvedValue(null);
        const userId = new Types.ObjectId().toHexString();
        await channel.send({ userId, type: 'reminder', title: 'T', body: 'B' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends a message to the cached dmChannelId', async () => {
        const connection = {
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(),
            discordUserId: '123',
            dmChannelId: 'chan-99',
        };
        mockFindOne.mockResolvedValue(connection);
        fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: String(connection.userId), type: 'reminder', title: 'Hi', body: 'Go!' });

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://discord.com/api/v10/channels/chan-99/messages');
        expect(opts.headers).toMatchObject({ Authorization: `Bot test-token` });
    });

    it('opens a DM channel when dmChannelId is null', async () => {
        const connection = {
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(),
            discordUserId: '456',
            dmChannelId: null,
        };
        mockFindOne.mockResolvedValue(connection);
        fetchSpy
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-chan' }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: String(connection.userId), type: 'daily_summary', title: 'T', body: 'B' });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        const [firstUrl] = fetchSpy.mock.calls[0] as [string];
        expect(firstUrl).toBe('https://discord.com/api/v10/users/@me/channels');
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(connection._id, { dmChannelId: 'new-chan' });
    });

    it('throws DiscordAuthExpiredError and deletes connection on 401', async () => {
        const connection = {
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(),
            discordUserId: '789',
            dmChannelId: 'chan-x',
        };
        mockFindOne.mockResolvedValue(connection);
        fetchSpy.mockResolvedValue({ ok: false, status: 401 });

        await expect(
            channel.send({ userId: String(connection.userId), type: 'reminder', title: 'T', body: 'B' }),
        ).rejects.toBeInstanceOf(DiscordAuthExpiredError);

        expect(mockDeleteOne).toHaveBeenCalledWith({ _id: connection._id });
    });
});
