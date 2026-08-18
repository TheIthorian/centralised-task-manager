import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type {
    AuthClientOptions,
    AuthorizedAppDto,
    GetOAuthClientInfoParams,
    LoginParams,
    OAuthClientInfoDto,
    RefreshParams,
    RegisterParams,
    RevokeAuthorizedAppParams,
    TokenPair,
} from './auth.types.js';

/** Login, token lifecycle, and the OAuth apps a user has authorized. */
export class AuthClient {
    private readonly http: ApiHttpClient;
    private readonly refreshToken: string | null;

    constructor({ http, refreshToken }: DomainClientOptions & AuthClientOptions) {
        this.http = http;
        this.refreshToken = refreshToken;
    }

    /** Login with email and password. */
    async login({ email, password }: LoginParams): Promise<TokenPair> {
        return this.http.request<TokenPair>({ method: 'POST', path: '/auth/login', body: { email, password } });
    }

    /** Register a new account. */
    async register({ name, email, password }: RegisterParams): Promise<TokenPair> {
        return this.http.request<TokenPair>({
            method: 'POST',
            path: '/auth/register',
            body: { name, email, password },
        });
    }

    /**
     * Exchange a refresh token for a new token pair. Web clients omit the token
     * and rely on the HttpOnly cookie.
     */
    async refresh({ refreshToken }: RefreshParams = {}): Promise<TokenPair> {
        const token = refreshToken ?? this.refreshToken;

        return this.http.request<TokenPair>({
            method: 'POST',
            path: '/auth/refresh',
            body: token ? { refreshToken: token } : {},
        });
    }

    /** Revoke the current refresh token. */
    async logout({ refreshToken }: RefreshParams = {}): Promise<void> {
        const token = refreshToken ?? this.refreshToken;

        await this.http.request<void>({
            method: 'POST',
            path: '/auth/logout',
            body: token ? { refreshToken: token } : {},
        });
    }

    /** List OAuth apps the current user has authorized. */
    async getAuthorizedApps(): Promise<AuthorizedAppDto[]> {
        return this.http.request<AuthorizedAppDto[]>({ method: 'GET', path: '/auth/me/authorized-apps' });
    }

    /** Revoke access for an authorized OAuth app. */
    async revokeAuthorizedApp({ clientId }: RevokeAuthorizedAppParams): Promise<void> {
        await this.http.request<void>({ method: 'DELETE', path: `/auth/me/authorized-apps/${encodeURIComponent(clientId)}` });
    }

    /** Public metadata for an OAuth client, for a consent screen to describe who is asking. */
    async getOAuthClientInfo({ clientId }: GetOAuthClientInfoParams): Promise<OAuthClientInfoDto> {
        return this.http.request<OAuthClientInfoDto>({
            method: 'GET',
            path: '/oauth/client-info',
            params: { client_id: clientId },
        });
    }
}
