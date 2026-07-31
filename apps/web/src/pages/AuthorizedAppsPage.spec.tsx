import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { AuthorizedAppDto } from '@ctm/api-client';
import { AuthorizedAppsPage } from './AuthorizedAppsPage.js';

const mockApi = {
    getAuthorizedApps: vi.fn(),
    revokeAuthorizedApp: vi.fn(),
};

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

const appWithMetadata: AuthorizedAppDto = {
    clientId: 'client_abc',
    clientName: 'Metadata App',
    scopes: ['openid'],
    authorizedAt: '2026-07-01T10:00:00.000Z',
    type: 'oauth',
    clientUri: 'https://example.com',
    tosUri: 'https://example.com/tos',
    policyUri: 'https://example.com/privacy',
    contacts: ['ops@example.com'],
    softwareId: 'example-client',
};

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return (
        <MemoryRouter>
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </MemoryRouter>
    );
}

describe('AuthorizedAppsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the metadata an app declared about itself', async () => {
        mockApi.getAuthorizedApps.mockResolvedValue([appWithMetadata]);

        render(<AuthorizedAppsPage />, { wrapper });

        expect(await screen.findByText('https://example.com/tos')).toBeInTheDocument();
        expect(screen.getByText('https://example.com')).toBeInTheDocument();
        expect(screen.getByText('https://example.com/privacy')).toBeInTheDocument();
        expect(screen.getByText('ops@example.com')).toBeInTheDocument();
        expect(screen.getByText('example-client')).toBeInTheDocument();
    });

    it('renders declared metadata as text, never as links or images', async () => {
        mockApi.getAuthorizedApps.mockResolvedValue([appWithMetadata]);

        const { container } = render(<AuthorizedAppsPage />, { wrapper });

        await screen.findByText('https://example.com/tos');

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
    });

    it('omits the metadata block for an app that declared none', async () => {
        mockApi.getAuthorizedApps.mockResolvedValue([
            {
                clientId: 'client_bare',
                clientName: 'Bare App',
                scopes: ['openid'],
                authorizedAt: '2026-07-01T10:00:00.000Z',
                type: 'oauth',
            } satisfies AuthorizedAppDto,
        ]);

        render(<AuthorizedAppsPage />, { wrapper });

        expect(await screen.findByText('Bare App')).toBeInTheDocument();
        expect(screen.queryByText('Declared by this app. Not verified.')).not.toBeInTheDocument();
    });
});
