import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client.error.js';
import { ApiHttpClient } from './api-http-client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('ApiHttpClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('sets the bearer token from constructor options', () => {
        new ApiHttpClient({ baseUrl: 'http://localhost:3000', accessToken: 'acc-token' });

        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'http://localhost:3000',
            headers: { Authorization: 'Bearer acc-token' },
        });
    });

    it('sends no authorization header when no access token is given', () => {
        new ApiHttpClient({ baseUrl: 'http://localhost:3000' });

        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'http://localhost:3000',
            headers: undefined,
        });
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
});
