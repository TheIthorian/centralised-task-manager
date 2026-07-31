import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CtmApiClient } from './client.js';

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

    it('builds one axios instance shared by every domain client', () => {
        new CtmApiClient({ baseUrl: 'http://localhost:3000', accessToken: 'acc-token' });

        expect(mockedAxios.create).toHaveBeenCalledTimes(1);
        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: 'http://localhost:3000',
            headers: { Authorization: 'Bearer acc-token' },
        });
    });

    it('passes the constructor refresh token through to the auth domain', async () => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000', refreshToken: 'ref-token' });

        mockInstance.request.mockResolvedValueOnce({ data: { accessToken: 'acc' } });

        await client.refresh();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/refresh',
            data: { refreshToken: 'ref-token' },
            params: undefined,
        });
    });

    it.each([
        ['getMe', '/users/me'],
        ['listConnectors', '/connectors'],
        ['getAppConfig', '/config'],
        ['getNotificationPreferences', '/notifications/preferences'],
        ['exportData', '/users/me/export'],
    ] as const)('delegates %s to its domain client', async (method, path) => {
        const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });

        mockInstance.request.mockResolvedValueOnce({ data: {} });

        await client[method]();

        expect(mockInstance.request).toHaveBeenCalledWith(expect.objectContaining({ url: path }));
    });
});
