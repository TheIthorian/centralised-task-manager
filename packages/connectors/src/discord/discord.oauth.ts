import { HttpClient, type Logger } from '@ctm/http-client';
import { ConnectorName, ConnectorType } from '../types.js';
import type { ConnectionDetailsSchema, ConnectionSettings, OAuthConnector, OAuthTokens } from '../types.js';
import type { DiscordTokenResponse, DiscordUserResponse } from './discord.types.js';

/** Configuration required to instantiate a {@link DiscordOAuthConnector}. */
export type DiscordOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    botToken: string;
    logger?: Logger;
};

export class DiscordOAuthConnector implements OAuthConnector {
    readonly name = ConnectorName.Discord;
    readonly connectorType = ConnectorType.Notification;
    readonly connectionDetailsSchema: ConnectionDetailsSchema = {};

    private readonly http: HttpClient;

    constructor(private readonly config: DiscordOAuthConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://discord.com/api/v10', logger: config.logger });
    }

    /** Build the Discord OAuth2 authorization URL. Requests identify + bot scopes with DM permission. */
    getAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'identify bot',
            permissions: '2048',
            state,
        });

        return `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for Discord OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const data = await this.postToken(
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        );

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? '',
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Refresh an expired Discord access token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const data = await this.postToken(
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        );

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Fetch the Discord snowflake user ID for the given access token. */
    async resolveUserId(tokens: OAuthTokens): Promise<string> {
        const data = await this.http.get<DiscordUserResponse>('/users/@me', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return data.id;
    }

    /** Resolve Discord-specific settings to persist in ConnectorConfig after OAuth. */
    async resolveConnectionSettings(tokens: OAuthTokens): Promise<ConnectionSettings> {
        const discordUserId = await this.resolveUserId(tokens);

        return {
            settings: { discordUserId, botToken: this.config.botToken, dmChannelId: null },
        };
    }

    private async postToken(params: URLSearchParams): Promise<DiscordTokenResponse> {
        return await this.http.post<DiscordTokenResponse>('/oauth2/token', params, {
            'Content-Type': 'application/x-www-form-urlencoded',
        });
    }
}
