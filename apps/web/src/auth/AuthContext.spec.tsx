import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.js';
import { ToastProvider } from '../toast/ToastContext.js';

const mockApi = {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
};

vi.mock('../api/web-api-client.js', () => ({
    WebApiClient: vi.fn(
        class MockWebApiClient {
            constructor() {
                return mockApi;
            }
        },
    ),
}));

function TestConsumer(): React.JSX.Element {
    const { user, login, logout } = useAuth();

    return (
        <div>
            <span data-testid="user">{user ? user.email : 'none'}</span>
            <button onClick={() => void login('a@b.com', 'pass')}>Login</button>
            <button onClick={logout}>Logout</button>
        </div>
    );
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.refresh.mockRejectedValue({ statusCode: 401, code: 'unauthorized', message: 'Unauthorized' });
    });

    it('bootstraps the session from the refresh cookie on mount', async () => {
        mockApi.refresh.mockResolvedValueOnce({
            accessToken: 'acc',
            user: { id: '1', email: 'a@b.com' },
        });

        render(
            <ToastProvider>
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            </ToastProvider>,
        );

        expect(await screen.findByText('a@b.com')).toBeInTheDocument();
        expect(mockApi.refresh).toHaveBeenCalledTimes(1);
    });

    it('treats a failed bootstrap refresh as logged out', async () => {
        render(
            <ToastProvider>
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            </ToastProvider>,
        );

        await waitFor(() => expect(mockApi.refresh).toHaveBeenCalled());
        expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('writes no auth cookie on login', async () => {
        const user = userEvent.setup();

        mockApi.login.mockResolvedValueOnce({
            accessToken: 'acc',
            user: { id: '1', email: 'a@b.com' },
        });

        render(
            <ToastProvider>
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            </ToastProvider>,
        );

        await user.click(screen.getByText('Login'));

        expect(await screen.findByText('a@b.com')).toBeInTheDocument();
        expect(document.cookie).not.toContain('ctm_');
    });

    it('calls the logout endpoint and clears the user', async () => {
        const user = userEvent.setup();

        mockApi.refresh.mockResolvedValueOnce({
            accessToken: 'acc',
            user: { id: '1', email: 'a@b.com' },
        });
        mockApi.logout.mockResolvedValueOnce(undefined);

        render(
            <ToastProvider>
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            </ToastProvider>,
        );

        expect(await screen.findByText('a@b.com')).toBeInTheDocument();

        await user.click(screen.getByText('Logout'));

        expect(mockApi.logout).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
    });
});
