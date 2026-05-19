import axios, { type AxiosInstance } from 'axios';

import { ExternalServiceError } from '@ctm/errors';

export interface HttpClientOptions {
    baseUrl: string;
    headers?: Record<string, string>;
}

export class HttpClient {
    private readonly client: AxiosInstance;

    constructor({ baseUrl, headers }: HttpClientOptions) {
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        });
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
                const text =
                    typeof body === 'string'
                        ? body
                        : body !== undefined
                          ? JSON.stringify(body)
                          : '';

                throw new ExternalServiceError(url, `HTTP ${status}: ${text}`);
            }

            throw error;
        }
    }
}
