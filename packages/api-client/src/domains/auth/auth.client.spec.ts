import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpClient } from '../../http/api-http-client.js';
import { AuthClient } from './auth.client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('AuthClient', () => {
    const mockInstance = {
        request: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
    });

    it('posts login credentials', async () => {
        const client = buildClient({ refreshToken: null });
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

    it('uses the constructor refresh token by default', async () => {
        const client = buildClient({ refreshToken: 'ref-token' });
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

    it('posts an empty body to refresh when no token is held', async () => {
        const client = buildClient({ refreshToken: null });
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

    it('posts the held token to logout', async () => {
        const client = buildClient({ refreshToken: 'rt' });

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
        const client = buildClient({ refreshToken: null });

        mockInstance.request.mockResolvedValueOnce({ data: undefined });

        await client.logout();

        expect(mockInstance.request).toHaveBeenCalledWith({
            method: 'POST',
            url: '/auth/logout',
            data: {},
            params: undefined,
        });
    });

    function buildClient({ refreshToken }: { refreshToken: string | null }): AuthClient {
        return new AuthClient({ http: new ApiHttpClient({ baseUrl: 'http://localhost:3000' }), refreshToken });
    }
});
