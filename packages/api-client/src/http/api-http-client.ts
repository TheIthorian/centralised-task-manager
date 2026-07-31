import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiClientError, RATE_LIMITED_STATUS } from './api-client.error.js';
import type { ApiClientOptions, RequestOptions } from './http.types.js';

/** Request plumbing shared by every domain client: one axios instance and one error shape. */
export class ApiHttpClient {
    private readonly client: AxiosInstance;

    constructor({ baseUrl, accessToken }: ApiClientOptions) {
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
            throw toApiClientError({ error, method, path });
        }
    }
}

function toApiClientError({ error, method, path }: { error: unknown; method: string; path: string }): ApiClientError {
    if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status ?? 0;
        const retryAfterSeconds = extractRetryAfterSeconds(error);

        return new ApiClientError({
            message:
                statusCode === RATE_LIMITED_STATUS
                    ? rateLimitMessage({ error, retryAfterSeconds })
                    : extractMessage(error),
            statusCode,
            method,
            path,
            responseBody: error.response?.data,
            ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        });
    }

    if (error instanceof Error) {
        return new ApiClientError({
            message: error.message,
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
}: {
    error: AxiosError;
    retryAfterSeconds: number | undefined;
}): string {
    const wait = retryAfterSeconds === undefined ? '' : ` Retry in ${retryAfterSeconds}s.`;

    return `${extractMessage(error)}${wait}`;
}

function extractMessage(error: AxiosError): string {
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

    return error.message;
}
