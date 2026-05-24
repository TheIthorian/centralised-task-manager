import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthTokens } from '../types.js';
import { DiscordOAuthConnector } from './discord.oauth.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            post = vi.fn();
            get = vi.fn();
        },
    };
});

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
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        connector = new DiscordOAuthConnector(config);
        mockHttp = (connector as any).http;
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
        it('POSTs form-encoded body to /oauth2/token and returns OAuthTokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'acc',
                refresh_token: 'ref',
                token_type: 'Bearer',
                expires_in: 604800,
                scope: 'identify bot',
            });

            const before = Date.now();
            const result = await connector.exchangeCode('code-abc');
            const after = Date.now();

            const [path, body, headers] = mockHttp.post.mock.calls[0] as [
                string,
                URLSearchParams,
                Record<string, string>,
            ];
            expect(path).toBe('/oauth2/token');
            expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(body.get('grant_type')).toBe('authorization_code');
            expect(body.get('code')).toBe('code-abc');
            expect(body.get('client_id')).toBe('client-id');
            expect(result.accessToken).toBe('acc');
            expect(result.refreshToken).toBe('ref');
            expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800 * 1000);
            expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 604800 * 1000);
        });

        it('defaults refreshToken to empty string when absent', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'acc',
                token_type: 'Bearer',
                expires_in: 604800,
                scope: 'identify bot',
            });

            const result = await connector.exchangeCode('code-abc');

            expect(result.refreshToken).toBe('');
        });
    });

    describe('refreshToken', () => {
        it('POSTs refresh_token grant and returns updated tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new-acc',
                refresh_token: 'new-ref',
                token_type: 'Bearer',
                expires_in: 604800,
                scope: 'identify bot',
            });

            const result = await connector.refreshToken(tokens);

            const [, body] = mockHttp.post.mock.calls[0] as [string, URLSearchParams];
            expect(body.get('grant_type')).toBe('refresh_token');
            expect(body.get('refresh_token')).toBe(tokens.refreshToken);
            expect(result.accessToken).toBe('new-acc');
            expect(result.refreshToken).toBe('new-ref');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new-acc',
                token_type: 'Bearer',
                expires_in: 604800,
                scope: 'identify bot',
            });

            const result = await connector.refreshToken(tokens);

            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });

    describe('resolveUserId', () => {
        it('GETs /users/@me with Bearer token and returns the user id', async () => {
            mockHttp.get.mockResolvedValue({ id: 'discord-user-123', username: 'testuser', discriminator: '0001' });

            const id = await connector.resolveUserId(tokens);

            expect(mockHttp.get).toHaveBeenCalledWith('/users/@me', { Authorization: 'Bearer access-token' });
            expect(id).toBe('discord-user-123');
        });
    });
});
