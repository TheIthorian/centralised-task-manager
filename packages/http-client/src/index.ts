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

export type HttpClientOptions = {
    baseUrl: string;
    headers?: Record<string, string>;
    logger?: Logger;
    obfuscateLogs?: boolean;
};

export class HttpClient {
    private readonly client: AxiosInstance;

    constructor({ baseUrl, headers, logger, obfuscateLogs = true }: HttpClientOptions) {
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

                logger.debug(
                    {
                        url,
                        status: response.status,
                        responseHeaders: redactObject(
                            response.headers as Record<string, unknown>,
                            obfuscate,
                        ),
                        responseBody: redactObject(response.data as unknown, obfuscate),
                    },
                    'outbound response',
                );

                return response;
            },
            (error: unknown) => {
                if (axios.isAxiosError(error) && error.response) {
                    const url = `${String(error.config?.baseURL ?? '')}${String(error.config?.url ?? '')}`;

                    logger.debug(
                        {
                            url,
                            status: error.response.status,
                            responseHeaders: redactObject(
                                error.response.headers as Record<string, unknown>,
                                obfuscate,
                            ),
                            responseBody: redactObject(error.response.data as unknown, obfuscate),
                        },
                        'outbound response error',
                    );
                }

                return Promise.reject(error);
            },
        );
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
