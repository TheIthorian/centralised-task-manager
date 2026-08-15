import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ConnectorsPage } from './ConnectorsPage.js';
import { ToastProvider } from '../toast/ToastContext.js';

const mockSocket = { on: vi.fn(), disconnect: vi.fn() };
const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
    io: (...args: unknown[]) => mockIo(...args),
}));

const mockApi = {
    getAccessToken: vi.fn(() => 'token-abc'),
    listConnectors: vi.fn(),
    getConnectorHealth: vi.fn(),
    getAppConfig: vi.fn(),
};

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
        <MemoryRouter>
            <QueryClientProvider client={qc}>
                <ToastProvider>{children}</ToastProvider>
            </QueryClientProvider>
        </MemoryRouter>
    );
}

describe('ConnectorsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.getAccessToken.mockReturnValue('token-abc');
        mockApi.listConnectors.mockResolvedValue([]);
        mockApi.getConnectorHealth.mockResolvedValue([]);
        mockApi.getAppConfig.mockResolvedValue({ mcpUrl: 'https://mcp.example.com' });
    });

    it('shows the MCP url served by the API', async () => {
        const { findByTestId } = render(<ConnectorsPage />, { wrapper });

        expect(await findByTestId('mcp-url')).toHaveTextContent('https://mcp.example.com');
    });

    // Regression: socket.io derives the namespace from the URI's pathname. `SyncGateway`
    // is on the default `/` namespace, so the client must connect with no namespace
    // argument (implicit same-origin default) and carry the proxy handshake through
    // `path` only — passing `config.apiUrl` (`/api`) here would request the
    // nonexistent `/api` namespace.
    it('connects to the default namespace via the proxied socket.io path', async () => {
        render(<ConnectorsPage />, { wrapper });

        await waitFor(() => {
            expect(mockIo).toHaveBeenCalledWith({
                path: '/api/socket.io',
                auth: { token: 'token-abc' },
                transports: ['websocket'],
            });
        });
    });
});
