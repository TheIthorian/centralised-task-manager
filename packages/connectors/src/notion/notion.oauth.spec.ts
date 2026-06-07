import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotionOAuthConnector } from './notion.oauth.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            post = vi.fn();
        },
    };
});

const config = {
    clientId: 'notion_client_id',
    clientSecret: 'notion_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/notion',
};

const tokens: OAuthTokens = {
    accessToken: 'notion_access_token',
    refreshToken: 'notion_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

describe('NotionOAuthConnector', () => {
    let connector: NotionOAuthConnector;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        connector = new NotionOAuthConnector(config);
        mockHttp = (connector as any).http;
    });

    it('has connectionDetailsSchema with databaseId remote_select', () => {
        expect(connector.connectionDetailsSchema['databaseId']?.inputDefinition).toMatchObject({
            type: 'remote_select',
        });
    });

    it('name is "notion"', () => {
        expect(connector.name).toBe('notion');
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, state, owner=user', () => {
            const url = connector.getAuthUrl('user-789');

            expect(url).toContain('client_id=notion_client_id');
            expect(url).toContain('state=user-789');
            expect(url).toContain('owner=user');
            expect(url).toContain('response_type=code');
            expect(url).toContain('redirect_uri=');
        });
    });

    describe('exchangeCode', () => {
        it('POSTs with Basic auth and returns tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
                token_type: 'bearer',
                bot_id: 'bot-1',
                workspace_id: 'ws-1',
                workspace_name: 'My Workspace',
            });

            const result = await connector.exchangeCode('code-abc');

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/oauth/token',
                { grant_type: 'authorization_code', code: 'code-abc', redirect_uri: config.redirectUri },
                { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
            );
            expect(result.accessToken).toBe('new_access');
            expect(result.refreshToken).toBe('');
            expect(result.expiresAt).toBeInstanceOf(Date);
        });

        it('uses refresh_token from response when present', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
                refresh_token: 'new_refresh',
                token_type: 'bearer',
                bot_id: 'bot-1',
                workspace_id: 'ws-1',
                workspace_name: 'Workspace',
            });

            const result = await connector.exchangeCode('code-abc');

            expect(result.refreshToken).toBe('new_refresh');
        });
    });

    describe('resolveAccountIdentity', () => {
        it('uses bot id and workspace name', async () => {
            (connector as any).http = {
                get: async () => ({
                    id: 'bot-1',
                    name: 'CTM',
                    bot: { workspace_name: 'Acme', owner: { user: { person: { email: 'me@acme.com' } } } },
                }),
            };

            const identity = await connector.resolveAccountIdentity({
                accessToken: 'tok',
                refreshToken: '',
                expiresAt: new Date(),
            });

            expect(identity).toEqual({ externalAccountId: 'bot-1', email: 'me@acme.com', label: 'Acme' });
        });
    });

    describe('refreshToken', () => {
        it('POSTs refresh_token grant with Basic auth and returns updated tokens', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'refreshed_access',
                refresh_token: 'refreshed_refresh',
                token_type: 'bearer',
                bot_id: 'bot-1',
                workspace_id: 'ws-1',
                workspace_name: 'Workspace',
            });

            const result = await connector.refreshToken(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/oauth/token',
                { grant_type: 'refresh_token', refresh_token: tokens.refreshToken },
                { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
            );
            expect(result.accessToken).toBe('refreshed_access');
            expect(result.refreshToken).toBe('refreshed_refresh');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'refreshed_access',
                token_type: 'bearer',
                bot_id: 'bot-1',
                workspace_id: 'ws-1',
                workspace_name: 'Workspace',
            });

            const result = await connector.refreshToken(tokens);

            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });
});
