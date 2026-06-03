/** OAuth2 token response from POST /oauth2/token */
export type DiscordTokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope: string;
};

/** User object from GET /users/@me */
export type DiscordUserResponse = {
    id: string;
    username: string;
    discriminator: string;
};

/** DM channel response from POST /users/@me/channels */
export type DiscordDmChannelResponse = {
    id: string;
    type: number;
};

export type DiscordAuthInfo = {
    application: {
        id: string;
        name: string;
    };
    scopes: string[];
    expires: string; // ISO timestamp
    user?: {
        id: string;
        username: string;
        discriminator: string;
        global_name: string | null;
    };
};

export type DiscordError = { message: string; code: number };
