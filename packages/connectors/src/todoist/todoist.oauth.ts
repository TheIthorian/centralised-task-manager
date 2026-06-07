import { type Logger, HttpClient } from '@ctm/http-client';

import { ConnectorName, ConnectorType } from '../types.js';
import type { ConnectionDetailsSchema, HealthCheckResult, OAuthConnector, OAuthTokens } from '../types.js';
import type { TodoistTokenResponse } from './todoist.types.js';

/** Configuration required to instantiate a {@link TodoistOAuthConnector}. */
export type TodoistOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

export class TodoistOAuthConnector implements OAuthConnector {
    readonly name = ConnectorName.Todoist;
    readonly connectorType = ConnectorType.TaskSync;
    readonly connectionDetailsSchema: ConnectionDetailsSchema = {};

    private readonly http: HttpClient;
    private readonly resourceHttp: HttpClient;

    constructor(private readonly config: TodoistOAuthConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://todoist.com', logger: config.logger });
        this.resourceHttp = new HttpClient({ baseUrl: 'https://api.todoist.com/api/v1', logger: config.logger });
    }

    /** Probe the Todoist API to verify the connection is healthy. */
    async healthCheck(tokens: OAuthTokens): Promise<HealthCheckResult> {
        try {
            await this.resourceHttp.get('/tasks?limit=1', { Authorization: `Bearer ${tokens.accessToken}` });
            return { source: this.name, healthy: true };
        } catch (err) {
            return {
                source: this.name,
                healthy: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            };
        }
    }

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: 'task:add,data:read,data:delete',
            state: userId,
            redirect_uri: this.config.redirectUri,
        });

        return `https://todoist.com/oauth/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. New apps receive short-lived access tokens with a refresh token. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.http.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? '',
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    }

    /** Refresh an expired access token using the stored refresh token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        if (!tokens.refreshToken) {
            return tokens;
        }

        const res = await this.http.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    }
}
