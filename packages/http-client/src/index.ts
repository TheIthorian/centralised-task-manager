import type { Readable } from 'node:stream';
import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { Logger } from 'pino';

import { ExternalServiceError } from '@ctm/errors';

const SENSITIVE_KEYS = new Set(['authorization', 'cookie', 'set-cookie']);
const SENSITIVE_KEY_PATTERN = /token|secret|password|key/i;

function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(key);
}

function redactObject(obj: unknown, obfuscate: boolean): unknown {
    if (!obfuscate || typeof obj !== 'object' || obj === null) return obj;

    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, isSensitiveKey(k) ? '[REDACTED]' : v]),
    );
}

export type { Logger };

/** A response whose body has not been read, so the caller can bound or abandon it. */
export type StreamResponse = {
    status: number;
    /** Header names are lower-cased; a repeated header keeps only its first value. */
    headers: Record<string, string>;
    /** Destroyed when it leaves the `using` block that received it, read or not. */
    body: DisposableStream;
};

/** A stream that closes itself at the end of the block that declared it with `using`. */
export type DisposableStream = Readable & Disposable;

/**
 * Marks a stream as disposable, so leaving the block destroys it however the block is left.
 *
 * Node's own `Symbol.asyncDispose` destroys a stream with an abort error, which nothing is left to
 * handle once the reader has gone, so the disposal is written here instead.
 */
export function disposableStream(stream: Readable): DisposableStream {
    return Object.assign(stream, {
        [Symbol.dispose]: (): void => {
            stream.destroy();
        },
    });
}

/** Options for constructing an {@link HttpClient} instance. */
export type HttpClientOptions = {
    /** Omit for a client that is only given absolute URLs. */
    baseUrl?: string;
    headers?: Record<string, string>;
    logger?: Logger;
    obfuscateLogs?: boolean;
};

/** Thin Axios wrapper with optional debug logging and automatic error mapping to {@link ExternalServiceError}. */
export class HttpClient {
    private readonly client: AxiosInstance;

    constructor({ baseUrl = '', headers, logger, obfuscateLogs = true }: HttpClientOptions) {
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        });

        if (logger) {
            this.attachDebugInterceptors(logger, obfuscateLogs);
        }
    }

    /** Send a GET request and return the parsed JSON response. */
    async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
        return this.send<T>({ method: 'GET', url: path, headers });
    }

    /** Send a POST request with a JSON body and return the parsed JSON response. */
    async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.send<T>({ method: 'POST', url: path, data: body, headers });
    }

    /** Send a PATCH request with a JSON body and return the parsed JSON response. */
    async patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.send<T>({ method: 'PATCH', url: path, data: body, headers });
    }

    /** Send a DELETE request. Returns undefined (204 No Content). */
    async delete(path: string, headers?: Record<string, string>): Promise<void> {
        await this.send<void>({ method: 'DELETE', url: path, headers });
    }

    /**
     * Send a GET request and return the response without reading its body, so the caller can cap
     * or abandon it. Redirects are never followed, and a non-2xx status is returned rather than
     * thrown: both are outcomes the caller has to classify.
     *
     * The caller owns the body and must destroy it if it does not read it to the end.
     */
    async getStream({
        url,
        headers,
        timeoutMs,
    }: {
        url: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
    }): Promise<StreamResponse> {
        try {
            const response = await this.client.request<Readable>({
                method: 'GET',
                url,
                headers,
                responseType: 'stream',
                timeout: timeoutMs,
                maxRedirects: 0,
                validateStatus: () => true,
            });

            return {
                status: response.status,
                headers: lowerCaseHeaders(response.headers),
                body: disposableStream(response.data),
            };
        } catch (error) {
            if (axios.isAxiosError(error)) throw new ExternalServiceError(url, error.message);

            throw error;
        }
    }

    private attachDebugInterceptors(logger: Logger, obfuscate: boolean): void {
        this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
            const url = `${String(config.baseURL ?? '')}${String(config.url ?? '')}`;

            logger.debug(
                {
                    url,
                    method: config.method?.toUpperCase(),
                    headers: redactObject((config.headers as Record<string, unknown>) ?? {}, obfuscate),
                    body: redactObject(config.data as unknown, obfuscate),
                },
                'outbound request',
            );

            return config;
        });

        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                const url = `${String(response.config.baseURL ?? '')}${String(response.config.url ?? '')}`;

                const { status, headers, body } = this.getResponseDetailsForLog(response, obfuscate);

                logger.debug(
                    {
                        url,
                        status,
                        responseHeaders: redactObject(headers as Record<string, unknown>, obfuscate),
                        responseBody: body,
                    },
                    'outbound response',
                );

                return response;
            },
            (error: unknown) => {
                if (axios.isAxiosError(error) && error.response) {
                    const url = `${String(error.config?.baseURL ?? '')}${String(error.config?.url ?? '')}`;

                    const { status, headers, body } = this.getResponseDetailsForLog(error.response, obfuscate);

                    logger.debug(
                        {
                            url,
                            status,
                            responseHeaders: redactObject(headers as Record<string, unknown>, obfuscate),
                            responseBody: body,
                        },
                        'outbound response error',
                    );
                }

                return Promise.reject(error);
            },
        );
    }

    private getResponseDetailsForLog(
        response: AxiosResponse,
        obfuscate: boolean,
    ): { status: number; headers: unknown; body: unknown } {
        const contentType = response.headers['content-type'] ?? '';
        const contentLength = response.headers['content-length'] ?? response.data.length ?? -1;
        const isJsonResponse = contentType.toString().includes('application/json');

        return {
            status: response.status,
            headers: redactObject(response.headers as Record<string, unknown>, obfuscate),
            body: isJsonResponse
                ? redactObject(response.data as unknown, obfuscate)
                : `Service returned ${contentType} of length ${contentLength}`,
        };
    }

    private async send<T>(config: {
        method: string;
        url: string;
        data?: unknown;
        headers?: Record<string, string>;
    }): Promise<T> {
        try {
            const response = await this.client.request<T>(config);

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const url = `${String(this.client.defaults.baseURL)}${config.url}`;
                const status = error.response?.status ?? 0;
                const body = error.response?.data;
                const text = typeof body === 'string' ? body : body !== undefined ? JSON.stringify(body) : '';

                throw new ExternalServiceError(url, `HTTP ${status}: ${text}`);
            }

            throw error;
        }
    }
}

function lowerCaseHeaders(headers: AxiosResponse['headers']): Record<string, string> {
    const entries = Object.entries(headers as Record<string, unknown>)
        .map(([key, value]): [string, string] => [key.toLowerCase(), Array.isArray(value) ? String(value[0]) : String(value)])
        .filter(([, value]) => value !== 'undefined');

    return Object.fromEntries(entries);
}
