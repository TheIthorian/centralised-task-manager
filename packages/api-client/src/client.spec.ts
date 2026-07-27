import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ApiClientError, CtmApiClient } from './client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('CtmApiClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('sets the bearer token from constructor options', () => {
        new CtmApiClient({
            baseUrl: 'http://localhost:3000',
            accessToken: 'acc-token',
            refreshToken: 'ref-token',
        });

        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'http://localhost:3000',
            headers: { Authorization: 'Bearer acc-token' },
        });
    });

    it('posts login credentials', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const payload = {
            accessToken: 'acc',
            refreshToken: 'ref',
            user: { id: '1', email: 'a@b.com' },
        };

        mockInstance.request.mockResolvedValueOnce({ data: payload });

        const result = await client.login({ email: 'a@b.com', password: 'pass' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/login',
            data: { email: 'a@b.com', password: 'pass' },
            params: undefined,
        });
        expect(result).toEqual(payload);
    });

    it('maps done filter to status query param', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        mockInstance.request.mockResolvedValueOnce({ data: [] });

        await client.listTasks({ filter: 'done' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/tasks',
            data: undefined,
            params: { status: 'done' },
        });
    });

    it('uses the constructor refresh token by default', async () => {
        const client = new CtmApiClient({
            baseUrl: 'http://localhost:3000',
            refreshToken: 'ref-token',
        });
        const payload = {
            accessToken: 'new-acc',
            refreshToken: 'new-ref',
            user: { id: '1', email: 'a@b.com' },
        };

        mockInstance.request.mockResolvedValueOnce({ data: payload });

        const result = await client.refresh();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/refresh',
            data: { refreshToken: 'ref-token' },
            params: undefined,
        });
        expect(result).toEqual(payload);
    });

    it('posts to the export endpoint', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const payload = {
            exportId: 'uuid-1',
            files: [{ filename: 'export-part-1.json', sizeBytes: 100, contentType: 'application/json', sha256: 'abc' }],
        };

        mockInstance.request.mockResolvedValueOnce({ data: payload });

        const result = await client.exportData();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/users/me/export',
            data: undefined,
            params: undefined,
        });
        expect(result).toEqual(payload);
    });

    it('downloads an export file as a blob', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const blob = new Blob(['{}'], { type: 'application/json' });

        mockInstance.request.mockResolvedValueOnce({ data: blob });

        const result = await client.downloadExportFile({ exportId: 'uuid-1', filename: 'export-part-1.json' });

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'GET',
            url: '/users/me/exports/uuid-1/export-part-1.json',
            data: undefined,
            params: undefined,
            responseType: 'blob',
        });
        expect(result).toBe(blob);
    });

    it('uploads import files as multipart form data', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const summary = {
            imported: { tasks: 2, notifications: 1 },
            skipped: { tasks: 0, notifications: 0 },
        };

        mockInstance.request.mockResolvedValueOnce({ data: summary });

        const file = new Blob(['{}'], { type: 'application/json' });
        const result = await client.importData({ files: [file], onConflict: 'replace' });

        expect(mockInstance.request).toHaveBeenCalledTimes(1);
        const callArg = mockInstance.request.mock.calls[0][0];

        expect(callArg.method).toBe('POST');
        expect(callArg.url).toBe('/users/me/import');
        expect(callArg.data).toBeInstanceOf(FormData);
        expect((callArg.data as FormData).get('onConflict')).toBe('replace');
        expect(result).toEqual(summary);
    });

    it('posts an empty body to refresh when no token is held', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const payload = { accessToken: 'acc', user: { id: '1', email: 'a@b.com' } };

        mockInstance.request.mockResolvedValueOnce({ data: payload });

        const result = await client.refresh();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/refresh',
            data: {},
            params: undefined,
        });
        expect(result).toEqual(payload);
    });

    it('posts the refresh token when one is held', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000', refreshToken: 'rt' });

        mockInstance.request.mockResolvedValueOnce({
            data: { accessToken: 'acc', refreshToken: 'rt2', user: { id: '1', email: 'a@b.com' } },
        });

        await client.refresh();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/refresh',
            data: { refreshToken: 'rt' },
            params: undefined,
        });
    });

    it('posts the held token to logout', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000', refreshToken: 'rt' });

        mockInstance.request.mockResolvedValueOnce({ data: undefined });

        await client.logout();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/logout',
            data: { refreshToken: 'rt' },
            params: undefined,
        });
    });

    it('posts an empty body to logout when no token is held', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });

        mockInstance.request.mockResolvedValueOnce({ data: undefined });

        await client.logout();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/logout',
            data: {},
            params: undefined,
        });
    });

    it('throws a structured error on failed requests', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const error = {
            isAxiosError: true,
            message: 'Request failed with status code 401',
            response: {
                status: 401,
                data: { message: 'Unauthorized' },
            },
        };

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce(error);

        await expect(client.getMe()).rejects.toEqual(
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
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
        const error = {
            isAxiosError: true,
            message: 'Request failed with status code 429',
            response: {
                status: 429,
                headers: { 'retry-after': '42' },
                data: { message: 'Rate limit exceeded. Slow down and retry later.' },
            },
        };

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce(error);

        const thrown = await client.getMe().catch((caught: unknown) => caught);

        expect(thrown).toBeInstanceOf(ApiClientError);

        const apiError = thrown as ApiClientError;

        expect(apiError.isRateLimited).toBe(true);
        expect(apiError.retryAfterSeconds).toBe(42);
        expect(apiError.message).toBe('Rate limit exceeded. Slow down and retry later. Retry in 42s.');
    });

    it('leaves retryAfterSeconds unset when the server sends no Retry-After', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });

        mockedAxios.isAxiosError.mockReturnValue(true);
        mockInstance.request.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Request failed with status code 429',
            response: { status: 429, headers: {}, data: { message: 'Too many requests' } },
        });

        const apiError = (await client.getMe().catch((caught: unknown) => caught)) as ApiClientError;

        expect(apiError.isRateLimited).toBe(true);
        expect(apiError.retryAfterSeconds).toBeUndefined();
        expect(apiError.message).toBe('Too many requests');
    });
});
