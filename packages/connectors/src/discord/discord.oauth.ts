import type { OAuthConnector, OAuthTokens } from '../types.js';
import type { DiscordTokenResponse, DiscordUserResponse } from './discord.types.js';

const DISCORD_API = 'https://discord.com/api/v10';

/** Configuration required to instantiate a {@link DiscordOAuthConnector}. */
export type DiscordOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
};

export class DiscordOAuthConnector implements OAuthConnector {
    readonly name = 'discord';

    constructor(private readonly config: DiscordOAuthConnectorConfig) {}

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
        const res = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);

        const data = (await res.json()) as DiscordTokenResponse;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? '',
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Refresh an expired Discord access token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const res = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) throw new Error(`Discord token refresh failed: ${res.status}`);

        const data = (await res.json()) as DiscordTokenResponse;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Fetch the Discord snowflake user ID for the given access token. */
    async resolveUserId(tokens: OAuthTokens): Promise<string> {
        const res = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });

        if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);

        const data = (await res.json()) as DiscordUserResponse;

        return data.id;
    }
}
