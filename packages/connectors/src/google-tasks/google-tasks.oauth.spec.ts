import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@ctm/http-client';
import { GoogleTasksOAuthConnector } from './google-tasks.oauth.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            post = vi.fn();
            get = vi.fn();
        },
    };
});

const config = {
    clientId: 'google_client_id',
    clientSecret: 'google_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/google_tasks',
};

const tokens: OAuthTokens = {
    accessToken: 'google_access_token',
    refreshToken: 'google_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('GoogleTasksOAuthConnector', () => {
    let connector: GoogleTasksOAuthConnector;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        connector = new GoogleTasksOAuthConnector(config);
        mockHttp = (connector as any).http;
    });

    describe('healthCheck', () => {
        it('returns healthy when the API responds successfully', async () => {
            mockHttp.get.mockResolvedValue({ aud: 'google_client_id' });

            const result = await connector.healthCheck(tokens);

            expect(mockHttp.get).toHaveBeenCalledWith(`tokeninfo?access_token=${tokens.accessToken}`, {
                Authorization: `Bearer ${tokens.accessToken}`,
            });
            expect(result).toEqual({ source: connector.name, healthy: true });
        });

        it('returns unhealthy with error when the API throws', async () => {
            mockHttp.get.mockRejectedValue(new Error('Token expired'));

            const result = await connector.healthCheck(tokens);

            expect(result.healthy).toBe(false);
            expect(result.error).toBe('Token expired');
        });
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state but not PKCE params', () => {
            const url = connector.getAuthUrl('user-456');

            expect(url).toContain('client_id=google_client_id');
            expect(url).toContain('state=user-456');
            expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Ftasks');
            expect(url).toContain('access_type=offline');
            expect(url).not.toContain('code_challenge');
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

            expect(mockHttp.post).toHaveBeenCalledWith('/token', {
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: 'code-abc',
                redirect_uri: config.redirectUri,
                grant_type: 'authorization_code',
            });
            expect(result.accessToken).toBe('new_access');
            expect(result.refreshToken).toBe('new_refresh');
            expect(result.expiresAt).toBeInstanceOf(Date);
        });
    });

    describe('resolveAccountIdentity', () => {
        it('returns sub as externalAccountId and email', async () => {
            (connector as any).userInfoHttp = {
                get: async () => ({ sub: 'google-123', email: 'a@b.com' }),
            };

            const identity = await connector.resolveAccountIdentity(tokens);

            expect(identity).toEqual({ externalAccountId: 'google-123', email: 'a@b.com' });
        });
    });

    describe('email scope', () => {
        it('getAuthUrl requests the email scope', () => {
            expect(connector.getAuthUrl('state')).toContain('email');
        });
    });

    describe('refreshToken', () => {
        it('POSTs refresh_token and returns updated tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'refreshed_access',
                expires_in: 3600,
            });

            const result = await connector.refreshToken(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith('/token', {
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: tokens.refreshToken,
                grant_type: 'refresh_token',
            });
            expect(result.accessToken).toBe('refreshed_access');
            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });
});
