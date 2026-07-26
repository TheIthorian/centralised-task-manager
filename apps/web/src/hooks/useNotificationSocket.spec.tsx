import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationSocket } from './useNotificationSocket.js';
import type { WebApiClient } from '../api/web-api-client.js';

const mockSocket = { on: vi.fn(), disconnect: vi.fn() };
const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
    io: (...args: unknown[]) => mockIo(...args),
}));

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useNotificationSocket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Regression: socket.io derives the namespace from the URI's pathname, not just
    // the transport `path` option. The server declares the gateway on `/notifications`
    // (not `/api/notifications`), so the client must request the `/notifications`
    // namespace explicitly and carry the proxy handshake through `path` only.
    it('connects to the /notifications namespace via the proxied socket.io path', () => {
        const api = { getAccessToken: () => 'token-123' } as unknown as WebApiClient;

        renderHook(() => useNotificationSocket(api), { wrapper });

        expect(mockIo).toHaveBeenCalledWith('/notifications', {
            path: '/api/socket.io',
            transports: ['websocket'],
            auth: { token: 'token-123' },
        });
    });

    it('does not connect when there is no access token', () => {
        const api = { getAccessToken: () => null } as unknown as WebApiClient;

        renderHook(() => useNotificationSocket(api), { wrapper });

        expect(mockIo).not.toHaveBeenCalled();
    });
});
