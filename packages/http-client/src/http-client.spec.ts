import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '@ctm/errors';

import { HttpClient } from './index.js';

vi.mock('axios');

const BASE_URL = 'https://api.example.com';

describe('HttpClient', () => {
    let mockRequest: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockRequest = vi.fn();
        vi.mocked(axios.create).mockReturnValue({
            request: mockRequest,
            defaults: { baseURL: BASE_URL },
        } as unknown as AxiosInstance);
    });

    it('sends GET to the correct path and returns parsed JSON', async () => {
        mockRequest.mockResolvedValue({ data: { id: '1', name: 'test' } });

        const result = await new HttpClient({ baseUrl: BASE_URL }).get<{
            id: string;
            name: string;
        }>('/items/1');

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'GET', url: '/items/1' }),
        );
        expect(result).toEqual({ id: '1', name: 'test' });
    });

    it('sends POST with JSON body', async () => {
        mockRequest.mockResolvedValue({ data: { id: '2' } });

        const result = await new HttpClient({ baseUrl: BASE_URL }).post<{ id: string }>('/items', {
            name: 'new item',
        });

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'POST', url: '/items', data: { name: 'new item' } }),
        );
        expect(result).toEqual({ id: '2' });
    });

    it('sends PATCH with JSON body', async () => {
        mockRequest.mockResolvedValue({ data: { id: '1', name: 'updated' } });

        await new HttpClient({ baseUrl: BASE_URL }).patch('/items/1', { name: 'updated' });

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'PATCH', url: '/items/1' }),
        );
    });

    it('sends DELETE', async () => {
        mockRequest.mockResolvedValue({ data: undefined });

        const result = await new HttpClient({ baseUrl: BASE_URL }).delete('/items/1');

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'DELETE', url: '/items/1' }),
        );
        expect(result).toBeUndefined();
    });

    it('throws ExternalServiceError on non-2xx response', async () => {
        const axiosError = { response: { status: 429, data: 'Too Many Requests' } };
        mockRequest.mockRejectedValue(axiosError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        await expect(new HttpClient({ baseUrl: BASE_URL }).get('/items')).rejects.toThrow(
            ExternalServiceError,
        );
        await expect(new HttpClient({ baseUrl: BASE_URL }).get('/items')).rejects.toThrow('429');
    });

    it('sets constructor headers on axios.create and passes per-request headers to request', async () => {
        mockRequest.mockResolvedValue({ data: {} });

        new HttpClient({ baseUrl: BASE_URL, headers: { Authorization: 'Bearer tok' } });

        expect(axios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
            }),
        );

        await new HttpClient({ baseUrl: BASE_URL }).get('/me', { 'X-Request-Id': 'abc' });

        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({ headers: { 'X-Request-Id': 'abc' } }),
        );
    });
});
