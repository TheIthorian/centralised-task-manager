import { ExternalServiceError } from '@ctm/errors';

export interface HttpClientOptions {
    baseUrl: string;
    headers?: Record<string, string>;
}

export class HttpClient {
    constructor(private readonly options: HttpClientOptions) {}

    /** Send a GET request and return the parsed JSON response. */
    async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('GET', path, undefined, headers);
    }

    /** Send a POST request with a JSON body and return the parsed JSON response. */
    async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('POST', path, body, headers);
    }

    /** Send a PATCH request with a JSON body and return the parsed JSON response. */
    async patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('PATCH', path, body, headers);
    }

    /** Send a DELETE request. Returns undefined (204 No Content). */
    async delete(path: string, headers?: Record<string, string>): Promise<void> {
        await this.request<void>('DELETE', path, undefined, headers);
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        extraHeaders?: Record<string, string>,
    ): Promise<T> {
        const url = `${this.options.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.options.headers,
            ...extraHeaders,
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new ExternalServiceError(url, `HTTP ${response.status}: ${text}`);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return response.json() as Promise<T>;
    }
}
