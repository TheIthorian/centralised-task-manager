import type { ApiClientErrorOptions } from './http.types.js';

export const RATE_LIMITED_STATUS = 429;

/** Structured HTTP error returned by the REST wrapper. */
export class ApiClientError extends Error {
    readonly statusCode: number;
    readonly method: string;
    readonly path: string;
    readonly responseBody?: unknown;
    /** Seconds to wait before retrying, from the `Retry-After` header of a 429. */
    readonly retryAfterSeconds?: number;

    constructor({ message, statusCode, method, path, responseBody, retryAfterSeconds }: ApiClientErrorOptions) {
        super(message);
        this.name = 'ApiClientError';
        this.statusCode = statusCode;
        this.method = method;
        this.path = path;
        this.responseBody = responseBody;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /** Whether the request was rejected by a rate limit rather than failing outright. */
    get isRateLimited(): boolean {
        return this.statusCode === RATE_LIMITED_STATUS;
    }
}
