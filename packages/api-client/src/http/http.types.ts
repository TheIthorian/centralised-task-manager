import type { ApiHttpClient } from './api-http-client.js';

/** Options for constructing a {@link CtmApiClient} instance. */
export type ApiClientOptions = {
    baseUrl: string;
    accessToken?: string | null;
    refreshToken?: string | null;
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
