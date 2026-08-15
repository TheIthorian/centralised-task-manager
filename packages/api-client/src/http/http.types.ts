import type { ApiHttpClient } from './api-http-client.js';

/** Which flow issued a refresh token, and therefore which endpoint will redeem it. */
export enum TokenGrant {
    Session = 'session',
    OAuth = 'oauth',
}

/** The credentials a client holds for one user on one server. */
export type AuthTokens = {
    accessToken: string | null;
    refreshToken: string | null;
    grant: TokenGrant;
};

/**
 * Where a consumer keeps its credentials. Supplying it lets the client rotate tokens on the
 * consumer's behalf; this package never decides the storage medium.
 */
export type TokenPersistence = {
    /** Called with the new token set each time one is issued, before the retried request goes out. */
    onTokensRefreshed(tokens: AuthTokens): void | Promise<void>;
};

/** Options for constructing a {@link CtmApiClient} instance. */
export type ApiClientOptions = {
    baseUrl: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    /** Defaults to a session grant, which is what `POST /auth/login` issues. */
    grant?: TokenGrant;
    persistence?: TokenPersistence;
};

/** A single REST call made through {@link ApiHttpClient.request}. */
export type RequestOptions = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    params?: Record<string, string>;
    responseType?: 'blob';
};

/** Options every domain client is constructed with. */
export type DomainClientOptions = {
    http: ApiHttpClient;
};

/** Options for constructing an {@link ApiClientError}. */
export type ApiClientErrorOptions = {
    message: string;
    statusCode: number;
    method: string;
    path: string;
    responseBody?: unknown;
    retryAfterSeconds?: number;
};
