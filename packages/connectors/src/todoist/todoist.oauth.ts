import { type Logger, HttpClient } from '@ctm/http-client';

import type { OAuthConnector, OAuthTokens } from '../types.js';
import type { TodoistTokenResponse } from './todoist.types.js';

/** Configuration required to instantiate a {@link TodoistOAuthConnector}. */
export type TodoistOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

export class TodoistOAuthConnector implements OAuthConnector {
    readonly name = 'todoist';

    private readonly http: HttpClient;

    constructor(private readonly config: TodoistOAuthConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://todoist.com', logger: config.logger });
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
