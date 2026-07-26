import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { SourcesPage } from './SourcesPage.js';

const mockSocket = { on: vi.fn(), disconnect: vi.fn() };
const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
    io: (...args: unknown[]) => mockIo(...args),
}));

const mockApi = {
    getAccessToken: vi.fn(() => 'token-abc'),
    listConnectors: vi.fn(),
    getConnectorHealth: vi.fn(),
};

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
        <MemoryRouter>
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </MemoryRouter>
    );
}

describe('SourcesPage sync socket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.getAccessToken.mockReturnValue('token-abc');
        mockApi.listConnectors.mockResolvedValue([]);
        mockApi.getConnectorHealth.mockResolvedValue([]);
    });

    // Regression: socket.io derives the namespace from the URI's pathname. `SyncGateway`
    // is on the default `/` namespace, so the client must connect with no namespace
    // argument (implicit same-origin default) and carry the proxy handshake through
    // `path` only — passing `config.apiUrl` (`/api`) here would request the
    // nonexistent `/api` namespace.
    it('connects to the default namespace via the proxied socket.io path', async () => {
        render(<SourcesPage />, { wrapper });

        await waitFor(() => {
            expect(mockIo).toHaveBeenCalledWith({
                path: '/api/socket.io',
                auth: { token: 'token-abc' },
                transports: ['websocket'],
            });
        });
    });
});
