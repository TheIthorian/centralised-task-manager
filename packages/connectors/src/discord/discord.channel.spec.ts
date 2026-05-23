import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordChannel } from './discord.channel.js';
import type { DiscordChannelConfig } from '../types.js';

const config: DiscordChannelConfig = {
    discordUserId: 'discord-user-1',
    botToken: 'bot-token',
    dmChannelId: 'chan-99',
};

describe('DiscordChannel', () => {
    let channel: DiscordChannel;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        channel = new DiscordChannel();
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    it('name is "discord"', () => {
        expect(channel.name).toBe('discord');
    });

    describe('send', () => {
        it('sends a message to the cached dmChannelId', async () => {
            fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

            await channel.send({ config, title: 'Hi', body: 'Go!' });

            expect(fetchSpy).toHaveBeenCalledOnce();
            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/channels/chan-99/messages');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bot bot-token');
            const body = JSON.parse(opts.body as string) as { content: string };
            expect(body.content).toContain('Hi');
            expect(body.content).toContain('Go!');
        });

        it('opens a DM channel when dmChannelId is null', async () => {
            const configWithoutChannel: DiscordChannelConfig = { ...config, dmChannelId: null };
            fetchSpy
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-chan', type: 1 }) })
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

            await channel.send({ config: configWithoutChannel, title: 'T', body: 'B' });

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const [firstUrl] = fetchSpy.mock.calls[0] as [string];
            expect(firstUrl).toBe('https://discord.com/api/v10/users/@me/channels');
        });

        it('throws on 401 when opening DM channel', async () => {
            const configWithoutChannel: DiscordChannelConfig = { ...config, dmChannelId: null };
            fetchSpy.mockResolvedValue({ ok: false, status: 401 });

            await expect(channel.send({ config: configWithoutChannel, title: 'T', body: 'B' })).rejects.toThrow(
                'Discord open DM failed: 401',
            );
        });

        it('throws on non-ok response when sending a message', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 500 });

            await expect(channel.send({ config, title: 'T', body: 'B' })).rejects.toThrow(
                'Discord send message failed: 500',
            );
        });
    });

    describe('openDmChannel', () => {
        it('POSTs to /users/@me/channels and returns the channel id', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ id: 'ch-123', type: 1 }) });

            const id = await channel.openDmChannel({ botToken: 'bot-token', discordUserId: 'user-1' });

            expect(id).toBe('ch-123');
            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/users/@me/channels');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bot bot-token');
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 403 });
            await expect(channel.openDmChannel({ botToken: 'bot-token', discordUserId: 'user-1' })).rejects.toThrow(
                'Discord open DM failed: 403',
            );
        });
    });
});
