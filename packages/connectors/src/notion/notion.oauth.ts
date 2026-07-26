import { HttpClient, type Logger } from '@ctm/http-client';

import { ConnectorName, ConnectorType } from '../types.js';
import type { AccountIdentity, ConnectionDetailsSchema, HealthCheckResult, OAuthConnector, OAuthTokens } from '../types.js';
import type { NotionMeResponse, NotionTokenResponse } from './notion.types.js';
import { NOTION_VERSION } from './notion.source.js';

/** Configuration required to instantiate a {@link NotionOAuthConnector}. */
export type NotionOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

// Notion only returns refresh_token/expires_in for integrations with token
// refresh enabled. Plain integrations get a non-expiring access token, so we
// park the expiry far in the future rather than inventing a 1h TTL we cannot
// honour (that made every sync attempt a doomed refresh).
const NON_EXPIRING_TTL_SECONDS = 100 * 365 * 24 * 3600;

export class NotionOAuthConnector implements OAuthConnector {
    readonly name = ConnectorName.Notion;
    readonly connectorType = ConnectorType.TaskSync;

    readonly connectionDetailsSchema: ConnectionDetailsSchema = {
        databaseId: {
            inputDefinition: {
                type: 'remote_select',
                label: 'Task Database',
                required: true,
                endpoint: '/connectors/connections/{connectionId}/notion/databases',
            },
            validationSchema: { type: 'string', minLength: 1 },
        },
    };

    private readonly http: HttpClient;

    constructor(private readonly config: NotionOAuthConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.notion.com', logger: config.logger });
    }

    /** Resolve the Notion workspace/bot identity via /v1/users/me. */
    async resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
        const me = await this.http.get<NotionMeResponse>('/v1/users/me', {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Notion-Version': NOTION_VERSION,
        });

        const email = me.bot.owner?.user?.person?.email;
        const label = me.bot.workspace_name ?? me.name ?? undefined;

        return { externalAccountId: me.id, email, label };
    }

    /** Probe the Notion API to verify the connection is healthy. */
    async healthCheck(tokens: OAuthTokens): Promise<HealthCheckResult> {
        try {
            await this.http.get<unknown>('/v1/users/me', {
                Authorization: `Bearer ${tokens.accessToken}`,
                'Notion-Version': NOTION_VERSION,
            });
            return { source: this.name, healthy: true };
        } catch (err) {
            return { source: this.name, healthy: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            owner: 'user',
            state: userId,
        });

        return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.http.post<NotionTokenResponse>(
            '/v1/oauth/token',
            { grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri },
            { Authorization: `Basic ${this.basicAuth()}`, 'Content-Type': 'application/json' },
        );

        return this.toTokens({ res, previousRefreshToken: '' });
    }

    /**
     * Refresh a Notion access token. Connections made without token refresh have
     * no refresh token and a non-expiring access token, so the existing token is
     * returned with its expiry pushed out instead of calling Notion.
     */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        if (!tokens.refreshToken) {
            return { ...tokens, expiresAt: this.expiryFrom(undefined) };
        }

        const res = await this.http.post<NotionTokenResponse>(
            '/v1/oauth/token',
            { grant_type: 'refresh_token', refresh_token: tokens.refreshToken },
            { Authorization: `Basic ${this.basicAuth()}`, 'Content-Type': 'application/json' },
        );

        return this.toTokens({ res, previousRefreshToken: tokens.refreshToken });
    }

    private toTokens({
        res,
        previousRefreshToken,
    }: {
        res: NotionTokenResponse;
        previousRefreshToken: string;
    }): OAuthTokens {
        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? previousRefreshToken,
            expiresAt: this.expiryFrom(res.expires_in),
        };
    }

    private expiryFrom(expiresInSeconds: number | undefined): Date {
        return new Date(Date.now() + (expiresInSeconds ?? NON_EXPIRING_TTL_SECONDS) * 1000);
    }

    private basicAuth(): string {
        return Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    }
}
