import { type Logger, HttpClient } from '@ctm/http-client';

import { OAuthError } from '@ctm/errors';

import { ConnectorName, ConnectorType } from '../types.js';
import type { ConnectionDetailsSchema, OAuthConnector, OAuthTokens } from '../types.js';
import type { GoogleTokenResponse } from './google-tasks.types.js';

/** Configuration required to instantiate a {@link GoogleTasksOAuthConnector}. */
export type GoogleTasksOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

export class GoogleTasksOAuthConnector implements OAuthConnector {
    readonly name = ConnectorName.GoogleTasks;
    readonly connectorType = ConnectorType.TaskSync;
    readonly connectionDetailsSchema: ConnectionDetailsSchema = {};

    private readonly http: HttpClient;

    constructor(private readonly config: GoogleTasksOAuthConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://oauth2.googleapis.com', logger: config.logger });
    }

    /** PKCE deferred to a future version — requires app-level verifier state management */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/tasks',
            access_type: 'offline',
            prompt: 'consent',
            state: userId,
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const response = await this.http.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
            grant_type: 'authorization_code',
        });

        if (!response.refresh_token) {
            throw new OAuthError('Google did not return a refresh token — ensure prompt=consent is set in the auth URL');
        }

        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    /** Refresh an expired access token using the stored refresh token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const response = await this.http.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: tokens.refreshToken,
            grant_type: 'refresh_token',
        });

        return {
            accessToken: response.access_token,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }
}
