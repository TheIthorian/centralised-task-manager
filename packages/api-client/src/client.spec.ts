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
});
