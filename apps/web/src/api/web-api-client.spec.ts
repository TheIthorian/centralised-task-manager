import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebApiClient } from './web-api-client.js';

const mockApiClient = {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
};

vi.mock('@ctm/api-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@ctm/api-client')>();

    return {
        ...actual,
        CtmApiClient: vi.fn(
            class MockCtmApiClient {
                constructor() {
                    return mockApiClient;
                }
            },
        ),
    };
});

function buildClient(): WebApiClient {
    return new WebApiClient({
        baseUrl: '/api',
        accessToken: null,
        onTokens: vi.fn(),
        onUnauthorized: vi.fn(),
        onError: vi.fn(),
    });
}

describe('WebApiClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('hands the access token from login to the client so getAccessToken reflects it', async () => {
        mockApiClient.login.mockResolvedValueOnce({
            accessToken: 'login-token',
            user: { id: '1', email: 'a@b.com' },
        });

        const client = buildClient();

        expect(client.getAccessToken()).toBeNull();

        await client.login({ email: 'a@b.com', password: 'pw' });

        expect(client.getAccessToken()).toBe('login-token');
    });

    it('hands the access token from register to the client so getAccessToken reflects it', async () => {
        mockApiClient.register.mockResolvedValueOnce({
            accessToken: 'register-token',
            user: { id: '1', email: 'a@b.com' },
        });

        const client = buildClient();

        await client.register({ name: 'A', email: 'a@b.com', password: 'pw' });

        expect(client.getAccessToken()).toBe('register-token');
    });

    it('clearTokens drops the held access token', async () => {
        mockApiClient.login.mockResolvedValueOnce({
            accessToken: 'login-token',
            user: { id: '1', email: 'a@b.com' },
        });

        const client = buildClient();

        await client.login({ email: 'a@b.com', password: 'pw' });
        expect(client.getAccessToken()).toBe('login-token');

        client.clearTokens();

        expect(client.getAccessToken()).toBeNull();
    });

    it('two concurrent refresh() calls produce exactly one HTTP request', async () => {
        let resolveRefresh: (tokens: { accessToken: string; user: { id: string; email: string } }) => void;
        mockApiClient.refresh.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveRefresh = resolve;
                }),
        );

        const client = buildClient();

        const first = client.refresh();
        const second = client.refresh();

        resolveRefresh!({ accessToken: 'refreshed-token', user: { id: '1', email: 'a@b.com' } });

        const [firstResult, secondResult] = await Promise.all([first, second]);

        expect(mockApiClient.refresh).toHaveBeenCalledTimes(1);
        expect(firstResult.accessToken).toBe('refreshed-token');
        expect(secondResult.accessToken).toBe('refreshed-token');
        expect(client.getAccessToken()).toBe('refreshed-token');
    });

    it('a refresh() call after the in-flight one resolves starts a new request', async () => {
        mockApiClient.refresh
            .mockResolvedValueOnce({ accessToken: 'first-token', user: { id: '1', email: 'a@b.com' } })
            .mockResolvedValueOnce({ accessToken: 'second-token', user: { id: '1', email: 'a@b.com' } });

        const client = buildClient();

        await client.refresh();
        await client.refresh();

        expect(mockApiClient.refresh).toHaveBeenCalledTimes(2);
        expect(client.getAccessToken()).toBe('second-token');
    });
});
