import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiClientError, RATE_LIMITED_STATUS } from './api-client.error.js';
import type { ApiClientOptions, RequestOptions } from './http.types.js';

/** Request plumbing shared by every domain client: one axios instance and one error shape. */
export class ApiHttpClient {
    private readonly client: AxiosInstance;
    private readonly baseUrl: string;

    constructor({ baseUrl, accessToken }: ApiClientOptions) {
        this.baseUrl = baseUrl;
        this.client = axios.create({
            baseURL: baseUrl,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
    }

    /** Issue a REST call, returning the response body or throwing an {@link ApiClientError}. */
    async request<T>({ method, path, body, params, responseType }: RequestOptions): Promise<T> {
        try {
            const response = await this.client.request<T>({
                method,
                url: path,
                data: body,
                params,
                ...(responseType !== undefined ? { responseType } : {}),
            });

            return response.data;
        } catch (error) {
            throw toApiClientError({ error, method, path, baseUrl: this.baseUrl });
        }
    }
}

function toApiClientError({
    error,
    method,
    path,
    baseUrl,
}: {
    error: unknown;
    method: string;
    path: string;
    baseUrl: string;
}): ApiClientError {
    const target = `${method} ${baseUrl}${path}`;

    if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status ?? 0;
        const retryAfterSeconds = extractRetryAfterSeconds(error);

        return new ApiClientError({
            message:
                statusCode === RATE_LIMITED_STATUS
                    ? rateLimitMessage({ error, retryAfterSeconds, target })
                    : extractMessage({ error, target }),
            statusCode,
            method,
            path,
            responseBody: error.response?.data,
            ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        });
    }

    if (error instanceof Error) {
        return new ApiClientError({
            message: error.message.length > 0 ? error.message : `${error.name}: ${target} failed`,
            statusCode: 0,
            method,
            path,
        });
    }

    return new ApiClientError({
        message: 'Unknown API client error',
        statusCode: 0,
        method,
        path,
        responseBody: error,
    });
}

function extractRetryAfterSeconds(error: AxiosError): number | undefined {
    const header = error.response?.headers?.['retry-after'];
    const seconds = Number(header);

    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

/** Rate-limit responses are actionable, so say how long to wait rather than just "429". */
function rateLimitMessage({
    error,
    retryAfterSeconds,
    target,
}: {
    error: AxiosError;
    retryAfterSeconds: number | undefined;
    target: string;
}): string {
    const wait = retryAfterSeconds === undefined ? '' : ` Retry in ${retryAfterSeconds}s.`;

    return `${extractMessage({ error, target })}${wait}`;
}

function extractMessage({ error, target }: { error: AxiosError; target: string }): string {
    const responseBody = error.response?.data;

    if (typeof responseBody === 'string' && responseBody.length > 0) {
        return responseBody;
    }

    if (responseBody !== null && typeof responseBody === 'object' && 'message' in responseBody) {
        const { message } = responseBody;

        if (typeof message === 'string' && message.length > 0) {
            return message;
        }

        if (Array.isArray(message)) {
            const parts = message.filter((part): part is string => typeof part === 'string' && part.length > 0);

            if (parts.length > 0) {
                return parts.join(', ');
            }
        }
    }

    if (error.message.length > 0) {
        return error.message;
    }

    return describeTransportFailure({ error, target });
}

/**
 * A request that never reached the server has no response body, and Node dials IPv6 and IPv4 in
 * parallel, so a refused connection arrives as an `AggregateError` with an empty message and one
 * inner error per address. The failure has to be rebuilt from the error code and those inners.
 */
function describeTransportFailure({ error, target }: { error: AxiosError; target: string }): string {
    const causes =
        error instanceof AggregateError
            ? error.errors
                  .filter((cause: unknown): cause is Error => cause instanceof Error && cause.message.length > 0)
                  .map((cause) => cause.message)
            : [];

    const detail = causes.length > 0 ? `: ${causes.join(', ')}` : '';

    return `${error.code ?? 'Request failed'}: ${target} failed${detail}`;
}
