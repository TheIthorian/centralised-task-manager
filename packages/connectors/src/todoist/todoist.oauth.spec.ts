import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@ctm/http-client';
import { TodoistOAuthConnector } from './todoist.oauth.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            post = vi.fn();
        },
    };
});

const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/todoist',
};

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('TodoistOAuthConnector', () => {
    let connector: TodoistOAuthConnector;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        connector = new TodoistOAuthConnector(config);
        mockHttp = (connector as any).http;
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-123');

            expect(url).toContain('client_id=test_client_id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=user-123');
            expect(url).toContain('scope=task%3Aadd%2Cdata%3Aread%2Cdata%3Adelete');
        });
    });

    describe('exchangeCode', () => {
        it('POSTs authorization code and returns tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
                refresh_token: 'new_refresh',
                expires_in: 3600,
            });

            const result = await connector.exchangeCode('code-abc');

            expect(mockHttp.post).toHaveBeenCalledWith('/oauth/access_token', {
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: 'code-abc',
                redirect_uri: config.redirectUri,
            });
            expect(result.accessToken).toBe('new_access');
            expect(result.refreshToken).toBe('new_refresh');
            expect(result.expiresAt).toBeInstanceOf(Date);
        });

        it('uses default expiry when response omits expires_in', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
            });

            const result = await connector.exchangeCode('code-abc');
            const expectedExpiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
            expect(result.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
        });
    });

    describe('refreshToken', () => {
        it('returns input unchanged if no refreshToken present', async () => {
            const noRefresh = { ...tokens, refreshToken: '' };
            const result = await connector.refreshToken(noRefresh);
            expect(result).toEqual(noRefresh);
            expect(mockHttp.post).not.toHaveBeenCalled();
        });

        it('POSTs refresh_token and returns updated tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'refreshed_access',
                refresh_token: 'refreshed_refresh',
                expires_in: 3600,
            });

            const result = await connector.refreshToken(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith('/oauth/access_token', {
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
            });
            expect(result.accessToken).toBe('refreshed_access');
            expect(result.refreshToken).toBe('refreshed_refresh');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'refreshed_access',
            });

            const result = await connector.refreshToken(tokens);

            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });
});
