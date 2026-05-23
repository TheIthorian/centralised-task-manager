import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthTokens } from '../types.js';
import { DiscordOAuthConnector } from './discord.oauth.js';

const config = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://example.com/connectors/discord/callback',
};

const tokens: OAuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('DiscordOAuthConnector', () => {
    let connector: DiscordOAuthConnector;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        connector = new DiscordOAuthConnector(config);
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    it('name is "discord"', () => {
        expect(connector.name).toBe('discord');
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, state, identify+bot scope, permissions=2048', () => {
            const url = connector.getAuthUrl('state-xyz');
            expect(url).toContain('client_id=client-id');
            expect(url).toContain('state=state-xyz');
            expect(url).toContain('scope=identify+bot');
            expect(url).toContain('permissions=2048');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('response_type=code');
        });
    });

    describe('exchangeCode', () => {
        it('posts form-encoded body and returns OAuthTokens', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'acc',
                    refresh_token: 'ref',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const before = Date.now();
            const result = await connector.exchangeCode('code-abc');
            const after = Date.now();

            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/oauth2/token');
            expect((opts.headers as Record<string, string>)['Content-Type']).toBe(
                'application/x-www-form-urlencoded',
            );
            expect(result.accessToken).toBe('acc');
            expect(result.refreshToken).toBe('ref');
            expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800 * 1000);
            expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 604800 * 1000);
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 400 });
            await expect(connector.exchangeCode('bad-code')).rejects.toThrow('Discord token exchange failed: 400');
        });
    });

    describe('refreshToken', () => {
        it('posts refresh_token grant and returns updated tokens', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'new-acc',
                    refresh_token: 'new-ref',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const result = await connector.refreshToken(tokens);

            expect(result.accessToken).toBe('new-acc');
            expect(result.refreshToken).toBe('new-ref');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'new-acc',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const result = await connector.refreshToken(tokens);
            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });

    describe('resolveUserId', () => {
        it('calls GET /users/@me with Bearer token and returns the user id', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'discord-user-123', username: 'testuser', discriminator: '0001' }),
            });

            const id = await connector.resolveUserId(tokens);

            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/users/@me');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
            expect(id).toBe('discord-user-123');
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 401 });
            await expect(connector.resolveUserId(tokens)).rejects.toThrow('Discord user fetch failed: 401');
        });
    });
});
