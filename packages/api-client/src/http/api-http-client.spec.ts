import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client.error.js';
import { ApiHttpClient } from './api-http-client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

function unexpiredToken(): string {
    const payload = btoa(JSON.stringify({ exp: 4_102_444_800 }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `header.${payload}.signature`;
}

describe('ApiHttpClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('sends the bearer token from constructor options', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:3000', accessToken: unexpiredToken() });

        mockInstance.request.mockResolvedValueOnce({ data: {} });

        await http.request({ method: 'GET', path: '/users/me' });

        expect(mockInstance.request).toHaveBeenCalledWith(
            expect.objectContaining({ headers: { Authorization: `Bearer ${unexpiredToken()}` } }),
        );
    });

    it('sends no authorization header when no access token is given', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:3000' });

        mockInstance.request.mockResolvedValueOnce({ data: {} });

        await http.request({ method: 'GET', path: '/users/me' });

        expect(mockInstance.request).toHaveBeenCalledWith(expect.not.objectContaining({ headers: expect.anything() }));
    });

    it('retries once behind a forced refresh when a valid-looking token is rejected', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ accessToken: 'refreshed-token', refreshToken: 'new-rt' }),
            }),
        );

        const http = new ApiHttpClient({
            baseUrl: 'http://localhost:3000',
            accessToken: unexpiredToken(),
            refreshToken: 'rt',
        });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request
            .mockRejectedValueOnce({ isAxiosError: true, message: 'Unauthorized', response: { status: 401, data: {} } })
            .mockResolvedValueOnce({ data: { id: 'user-1' } });

        expect(await http.request({ method: 'GET', path: '/users/me' })).toEqual({ id: 'user-1' });
        expect(mockInstance.request).toHaveBeenLastCalledWith(
            expect.objectContaining({ headers: { Authorization: 'Bearer refreshed-token' } }),
        );
    });

    it('reports the original 401 when the refresh also fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

        const http = new ApiHttpClient({
            baseUrl: 'http://localhost:3000',
            accessToken: unexpiredToken(),
            refreshToken: 'rt',
        });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValue({
            isAxiosError: true,
            message: 'Unauthorized',
            response: { status: 401, data: { message: 'Unauthorized' } },
        });

        await expect(http.request({ method: 'GET', path: '/users/me' })).rejects.toBeInstanceOf(ApiClientError);
    });

    it('throws a structured error on failed requests', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:3000' });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Request failed with status code 401',
            response: {
                status: 401,
                data: { message: 'Unauthorized' },
            },
        });

        await expect(http.request({ method: 'GET', path: '/users/me' })).rejects.toEqual(
            new ApiClientError({
                message: 'Unauthorized',
                statusCode: 401,
                method: 'GET',
                path: '/users/me',
                responseBody: { message: 'Unauthorized' },
            }),
        );
    });

    it('surfaces a rate limit with its retry delay', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:3000' });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Request failed with status code 429',
            response: {
                status: 429,
                headers: { 'retry-after': '42' },
                data: { message: 'Rate limit exceeded. Slow down and retry later.' },
            },
        });

        const thrown = await http.request({ method: 'GET', path: '/users/me' }).catch((caught: unknown) => caught);

        expect(thrown).toBeInstanceOf(ApiClientError);

        const apiError = thrown as ApiClientError;

        expect(apiError.isRateLimited).toBe(true);
        expect(apiError.retryAfterSeconds).toBe(42);
        expect(apiError.message).toBe('Rate limit exceeded. Slow down and retry later. Retry in 42s.');
    });

    it('leaves retryAfterSeconds unset when the server sends no Retry-After', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:3000' });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Request failed with status code 429',
            response: { status: 429, headers: {}, data: { message: 'Too many requests' } },
        });

        const apiError = (await http
            .request({ method: 'GET', path: '/users/me' })
            .catch((caught: unknown) => caught)) as ApiClientError;

        expect(apiError.isRateLimited).toBe(true);
        expect(apiError.retryAfterSeconds).toBeUndefined();
        expect(apiError.message).toBe('Too many requests');
    });

    // Node dials IPv6 and IPv4 in parallel (`autoSelectFamily`, on by default since Node 20). When
    // every address is refused it throws an AggregateError whose own message is empty.
    it('describes a transport failure whose axios error carries no message', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:59999' });

        const aggregate = new AggregateError(
            [new Error('connect ECONNREFUSED ::1:59999'), new Error('connect ECONNREFUSED 127.0.0.1:59999')],
            '',
        );

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce(Object.assign(aggregate, { isAxiosError: true, code: 'ECONNREFUSED' }));

        const apiError = (await http
            .request({ method: 'GET', path: '/tasks' })
            .catch((caught: unknown) => caught)) as ApiClientError;

        expect(apiError.statusCode).toBe(0);
        expect(apiError.message).toContain('ECONNREFUSED');
        expect(apiError.message).toContain('GET http://localhost:59999/tasks');
    });

    it('falls back to the error code alone when nothing else describes the failure', async () => {
        const http = new ApiHttpClient({ baseUrl: 'http://localhost:59999' });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce({ isAxiosError: true, message: '', code: 'ETIMEDOUT' });

        const apiError = (await http
            .request({ method: 'GET', path: '/tasks' })
            .catch((caught: unknown) => caught)) as ApiClientError;

        expect(apiError.message).toBe('ETIMEDOUT: GET http://localhost:59999/tasks failed');
    });
});
