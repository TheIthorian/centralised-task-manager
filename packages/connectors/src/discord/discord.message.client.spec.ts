import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@ctm/http-client';
import { DiscordMessageClient } from './discord.message.client.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            post = vi.fn();
        },
    };
});

describe('DiscordMessageClient', () => {
    let client: DiscordMessageClient;
    let mockHttpClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockHttpClient = new HttpClient({ baseUrl: 'https://discord.com/api/v10' });
        client = new DiscordMessageClient(mockHttpClient);
    });

    it('name is "discord"', () => {
        expect(client.name).toBe('discord');
    });

    describe('send', () => {
        it('POSTs message to discord channel with correct token', async () => {
            mockHttpClient.post.mockResolvedValue({});

            await client.send({
                channelId: 'chan-99',
                botToken: 'bot-token',
                title: 'Hi',
                body: 'Go!',
            });

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/channels/chan-99/messages',
                { content: '**Hi**\nGo!' },
                { Authorization: 'Bot bot-token', 'Content-Type': 'application/json' },
            );
        });
    });

    describe('openDmChannel', () => {
        it('POSTs to @me/channels and returns the channel response', async () => {
            const mockResponse = { id: 'ch-123', type: 1 };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const res = await client.openDmChannel({
                botToken: 'bot-token',
                discordUserId: 'user-1',
            });

            expect(res).toEqual(mockResponse);
            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/users/@me/channels',
                { recipient_id: 'user-1' },
                { Authorization: 'Bot bot-token', 'Content-Type': 'application/json' },
            );
        });
    });
});
