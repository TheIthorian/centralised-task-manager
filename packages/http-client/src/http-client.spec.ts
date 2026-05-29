import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '@ctm/errors';

import { HttpClient } from './index.js';

vi.mock('axios');

const BASE_URL = 'https://api.example.com';

function makeMockAxiosInstance(mockRequest: ReturnType<typeof vi.fn>): AxiosInstance {
    return {
        request: mockRequest,
        defaults: { baseURL: BASE_URL },
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
    } as unknown as AxiosInstance;
}

describe('HttpClient', () => {
    let mockRequest: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockRequest = vi.fn();
        vi.mocked(axios.create).mockReturnValue(makeMockAxiosInstance(mockRequest));
    });

    it('sends GET to the correct path and returns parsed JSON', async () => {
        mockRequest.mockResolvedValue({ data: { id: '1', name: 'test' } });

        const result = await new HttpClient({ baseUrl: BASE_URL }).get<{
            id: string;
            name: string;
        }>('/items/1');

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/items/1' }));
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

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH', url: '/items/1' }));
    });

    it('sends DELETE', async () => {
        mockRequest.mockResolvedValue({ data: undefined });

        const result = await new HttpClient({ baseUrl: BASE_URL }).delete('/items/1');

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE', url: '/items/1' }));
        expect(result).toBeUndefined();
    });

    it('throws ExternalServiceError on non-2xx response', async () => {
        const axiosError = { response: { status: 429, data: 'Too Many Requests' } };
        mockRequest.mockRejectedValue(axiosError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        await expect(new HttpClient({ baseUrl: BASE_URL }).get('/items')).rejects.toThrow(ExternalServiceError);
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

        expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ headers: { 'X-Request-Id': 'abc' } }));
    });

    describe('debug interceptors', () => {
        const mockLogger = { debug: vi.fn() };

        function getInterceptors(): {
            requestHandler: (config: unknown) => unknown;
            responseHandler: (res: unknown) => unknown;
            responseErrorHandler: (err: unknown) => Promise<never>;
        } {
            const instance = vi.mocked(axios.create).mock.results.at(-1)?.value as ReturnType<
                typeof makeMockAxiosInstance
            >;
            const requestUseCalls = vi.mocked(instance.interceptors.request.use).mock.calls;
            const responseUseCalls = vi.mocked(instance.interceptors.response.use).mock.calls;

            return {
                requestHandler: requestUseCalls[0][0] as (config: unknown) => unknown,
                responseHandler: responseUseCalls[0][0] as (res: unknown) => unknown,
                responseErrorHandler: responseUseCalls[0][1] as (err: unknown) => Promise<never>,
            };
        }

        beforeEach(() => {
            vi.resetAllMocks();
            mockRequest = vi.fn();
            vi.mocked(axios.create).mockReturnValue(makeMockAxiosInstance(mockRequest));
            mockLogger.debug.mockReset();
        });

        it('logs outbound request with url, method, headers, body', () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger });

            const { requestHandler } = getInterceptors();
            const config = {
                baseURL: BASE_URL,
                url: '/items',
                method: 'post',
                headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
                data: { name: 'test' },
            };

            requestHandler(config);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: `${BASE_URL}/items`,
                    method: 'POST',
                    headers: expect.objectContaining({ Authorization: '[REDACTED]' }),
                    body: expect.objectContaining({ name: 'test' }),
                }),
                'outbound request',
            );
        });

        it('logs response with status, headers, body', () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger });

            const { responseHandler } = getInterceptors();
            const response = {
                config: { baseURL: BASE_URL, url: '/items' },
                status: 200,
                headers: { 'content-type': 'application/json' },
                data: { id: '1' },
            };

            responseHandler(response);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: `${BASE_URL}/items`,
                    status: 200,
                    responseBody: expect.objectContaining({ id: '1' }),
                }),
                'outbound response',
            );
        });

        it('logs error responses before re-throwing', async () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger });
            vi.mocked(axios.isAxiosError).mockReturnValue(true);

            const { responseErrorHandler } = getInterceptors();
            const error = {
                config: { baseURL: BASE_URL, url: '/items' },
                response: { status: 429, headers: {}, data: 'rate limited' },
            };

            await expect(responseErrorHandler(error)).rejects.toBe(error);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({ status: 429 }),
                'outbound response error',
            );
        });

        it('redacts Authorization header by default', () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger });

            const { requestHandler } = getInterceptors();
            requestHandler({
                baseURL: BASE_URL,
                url: '/secure',
                method: 'get',
                headers: { Authorization: 'Bearer secret-token' },
                data: undefined,
            });

            const logged = mockLogger.debug.mock.calls[0][0] as Record<string, unknown>;
            expect((logged.headers as Record<string, string>).Authorization).toBe('[REDACTED]');
        });

        it('redacts sensitive body fields by default', () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger });

            const { requestHandler } = getInterceptors();
            requestHandler({
                baseURL: BASE_URL,
                url: '/auth',
                method: 'post',
                headers: {},
                data: { client_id: 'id', client_secret: 'shh', access_token: 'tok', username: 'ben' },
            });

            const logged = mockLogger.debug.mock.calls[0][0] as Record<string, unknown>;
            const body = logged.body as Record<string, string>;
            expect(body.client_secret).toBe('[REDACTED]');
            expect(body.access_token).toBe('[REDACTED]');
            expect(body.client_id).toBe('id');
            expect(body.username).toBe('ben');
        });

        it('skips redaction when obfuscateLogs is false', () => {
            new HttpClient({ baseUrl: BASE_URL, logger: mockLogger, obfuscateLogs: false });

            const { requestHandler } = getInterceptors();
            requestHandler({
                baseURL: BASE_URL,
                url: '/secure',
                method: 'get',
                headers: { Authorization: 'Bearer real-token' },
                data: { client_secret: 'visible' },
            });

            const logged = mockLogger.debug.mock.calls[0][0] as Record<string, unknown>;
            expect((logged.headers as Record<string, string>).Authorization).toBe('Bearer real-token');
            expect((logged.body as Record<string, string>).client_secret).toBe('visible');
        });

        it('does not attach interceptors when no logger provided', () => {
            new HttpClient({ baseUrl: BASE_URL });

            const instance = vi.mocked(axios.create).mock.results.at(-1)?.value as ReturnType<
                typeof makeMockAxiosInstance
            >;

            expect(vi.mocked(instance.interceptors.request.use)).not.toHaveBeenCalled();
            expect(vi.mocked(instance.interceptors.response.use)).not.toHaveBeenCalled();
        });
    });
});
