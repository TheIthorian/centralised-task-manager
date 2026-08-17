import type { UserDto } from '../users/users.types.js';

/** Access/refresh token pair returned after login or refresh. */
export type TokenPair = {
    accessToken: string;
    /** Lifetime of `accessToken` in seconds, so clients can refresh before it expires. */
    expiresIn: number;
    /** Omitted for web clients — the refresh token is returned as an HttpOnly cookie instead. */
    refreshToken?: string;
    user: UserDto;
};

/** Request body for POST /auth/login. */
export type LoginDto = {
    email: string;
    password: string;
};

/** Request body for POST /auth/register. */
export type RegisterDto = {
    name: string;
    email: string;
    password: string;
};

/** Request body for POST /auth/refresh and POST /auth/logout. */
export type RefreshDto = {
    /** Omitted by web clients, which carry the refresh token in the ctm_refresh cookie. */
    refreshToken?: string;
};

/**
 * An OAuth client that a user has authorized. No token data included.
 *
 * Every field below `type` is RFC 7591 metadata the client declared about itself at registration
 * and that this server has not verified. The declared `logo_uri` is never exposed: it is an
 * attacker-controlled URL that would otherwise be fetched by the browser of every user viewing
 * their settings page.
 */
export type AuthorizedAppDto = {
    clientId: string;
    clientName: string;
    scopes: string[];
    authorizedAt: string;
    type: 'oauth';

    /**
     * Path on the API origin serving this server's own re-encoded copy of the client's logo.
     * Absent when the client declared no logo, or when the declared one could not be used.
     */
    logoPath?: string;
    clientUri?: string;
    tosUri?: string;
    policyUri?: string;
    contacts?: string[];
    softwareId?: string;
};

/**
 * Public metadata for an OAuth client, shown on the consent screen.
 *
 * `clientName` is self-declared by the client and `isDynamic` says whether it registered itself
 * through the public registration endpoint, so a consumer must treat the name of a dynamic client
 * as an unverified claim.
 */
export type OAuthClientInfoDto = {
    clientId: string;
    clientName: string;
    isDynamic: boolean;
    /** Distinct hosts of the client's registered redirect URIs, in registration order. */
    redirectHosts: string[];
};

/** Parameters for {@link AuthClient.login}. */
export type LoginParams = LoginDto;

/** Parameters for {@link AuthClient.register}. */
export type RegisterParams = RegisterDto;

/** Parameters for {@link AuthClient.refresh}. Omit to use the token passed to the constructor. */
export type RefreshParams = RefreshDto;

/** Parameters for {@link AuthClient.revokeAuthorizedApp}. */
export type RevokeAuthorizedAppParams = {
    clientId: string;
};

/** Parameters for {@link AuthClient.getOAuthClientInfo}. */
export type GetOAuthClientInfoParams = {
    clientId: string;
};

/** Options for constructing an {@link AuthClient}. */
export type AuthClientOptions = {
    refreshToken: string | null;
};
