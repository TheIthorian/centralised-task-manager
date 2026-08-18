import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { OAuthClientInfoDto } from '@ctm/api-client';
import { OAuthConsentPage } from './OAuthConsentPage.js';

const mockUser = { id: '1', email: 'user@example.com', name: 'Test User' };
const mockApi = {
    getAccessToken: vi.fn(() => 'mock-token'),
    getOAuthClientInfo: vi.fn<() => Promise<OAuthClientInfoDto>>(),
};

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: vi.fn(() => ({ user: mockUser, isLoading: false, api: mockApi })),
}));

function renderConsentPage(search: string): ReturnType<typeof render> {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/oauth/consent${search}`]}>
                <Routes>
                    <Route path="/oauth/consent" element={<OAuthConsentPage />} />
                    <Route path="/login" element={<div>Login page</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('OAuthConsentPage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockApi.getAccessToken.mockReturnValue('mock-token');
        mockApi.getOAuthClientInfo.mockReset();
    });

    it('renders the requesting access header', () => {
        renderConsentPage(
            '?scope=tasks:read+tasks:write&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        expect(screen.getByText(/requesting access/i)).toBeInTheDocument();
    });

    it('shows the signed-in user email', () => {
        renderConsentPage(
            '?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        expect(screen.getByText(/user@example.com/i)).toBeInTheDocument();
    });

    it('renders scope groups from the scope query param', () => {
        renderConsentPage(
            '?scope=tasks:read+tasks:write+notifications:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('Notifications')).toBeInTheDocument();
        expect(screen.getByText('Read tasks')).toBeInTheDocument();
    });

    it('renders openid as locked/required', () => {
        renderConsentPage(
            '?scope=openid+tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it('allows toggling a scope off', () => {
        renderConsentPage(
            '?scope=tasks:read+tasks:write&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        const writeCheckbox = screen.getByRole('checkbox', { name: /create & manage tasks/i });
        expect(writeCheckbox).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(writeCheckbox);
        expect(writeCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('does not render email or password fields', () => {
        renderConsentPage(
            '?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    });

    it('shows session expired error on 401', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
        renderConsentPage(
            '?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        fireEvent.click(screen.getByRole('button', { name: /authorise/i }));
        await waitFor(() => expect(screen.getByText(/session expired/i)).toBeInTheDocument());
    });

    it('redirects browser on successful authorisation', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            status: 200,
            ok: true,
            json: () => Promise.resolve({ location: 'http://localhost:4000/cb?code=abc123' }),
        });
        vi.stubGlobal('fetch', mockFetch);
        const assignSpy = vi.fn();
        Object.defineProperty(window, 'location', { value: { assign: assignSpy }, writable: true });

        renderConsentPage(
            '?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
        );
        fireEvent.click(screen.getByRole('button', { name: /authorise/i }));

        await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('http://localhost:4000/cb?code=abc123'));
    });

    describe('client verification', () => {
        const baseSearch =
            '?client_id=client_abc&scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code';

        it('warns that a dynamically registered client is unverified', async () => {
            mockApi.getOAuthClientInfo.mockResolvedValue({
                clientId: 'client_abc',
                clientName: 'Google Tasks (Official)',
                isVerified: false,
                redirectHosts: ['tasks-officiaI.example.com'],
            });

            renderConsentPage(baseSearch);

            expect(await screen.findByText(/unverified app/i)).toBeInTheDocument();
            expect(screen.getByText('tasks-officiaI.example.com')).toBeInTheDocument();
        });

        it('names the requesting client from its registered name', async () => {
            mockApi.getOAuthClientInfo.mockResolvedValue({
                clientId: 'client_abc',
                clientName: 'Claude',
                isVerified: false,
                redirectHosts: ['claude.ai'],
            });

            renderConsentPage(baseSearch);

            expect(await screen.findByText(/claude is requesting access/i)).toBeInTheDocument();
        });

        it('shows no warning for a client this server vouches for', async () => {
            mockApi.getOAuthClientInfo.mockResolvedValue({
                clientId: 'client_abc',
                clientName: 'CTM MCP Server',
                isVerified: true,
                redirectHosts: ['mcp.example.com'],
            });

            renderConsentPage(baseSearch);

            await screen.findByText(/ctm mcp server is requesting access/i);
            expect(screen.queryByText(/unverified app/i)).not.toBeInTheDocument();
        });

        it('stays usable when the client lookup fails', async () => {
            mockApi.getOAuthClientInfo.mockRejectedValue(new Error('network down'));

            renderConsentPage(baseSearch);

            await waitFor(() => expect(mockApi.getOAuthClientInfo).toHaveBeenCalled());
            expect(screen.getByRole('button', { name: /authorise/i })).toBeEnabled();
            expect(screen.queryByText(/unverified app/i)).not.toBeInTheDocument();
        });

        it('does not look up a client when the request carries no client_id', () => {
            renderConsentPage(
                '?scope=tasks:read&redirect_uri=http://localhost:4000/cb&code_challenge=abc&response_type=code',
            );

            expect(mockApi.getOAuthClientInfo).not.toHaveBeenCalled();
            expect(screen.getByText(/an app is requesting access/i)).toBeInTheDocument();
        });
    });
});
