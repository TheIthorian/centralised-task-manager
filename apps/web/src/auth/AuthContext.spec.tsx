import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.js';
import { ToastProvider } from '../toast/ToastContext.js';

const mockApi = {
    login: vi.fn(),
    register: vi.fn(),
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

vi.mock('js-cookie', () => {
    const store: Record<string, string> = {};

    return {
        default: {
            get: (key: string) => store[key],
            set: (key: string, value: string) => {
                store[key] = value;
            },
            remove: (key: string) => {
                delete store[key];
            },
        },
    };
});

import Cookies from 'js-cookie';

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
        Cookies.remove('ctm_user');
        vi.clearAllMocks();
    });

    it('starts with no user when no cookie is set', () => {
        render(
            <ToastProvider>
                <AuthProvider>
                    <TestConsumer />
                </AuthProvider>
            </ToastProvider>,
        );
        expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('sets user after successful login', async () => {
        const user = userEvent.setup();

        mockApi.login.mockResolvedValueOnce({
            accessToken: 'acc',
            refreshToken: 'ref',
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

        expect(screen.getByTestId('user').textContent).toBe('a@b.com');
        expect(Cookies.get('ctm_access_token')).toBe('acc');
        expect(Cookies.get('ctm_refresh_token')).toBe('ref');
    });

    it('clears user after logout', async () => {
        const user = userEvent.setup();

        mockApi.login.mockResolvedValueOnce({
            accessToken: 'acc',
            refreshToken: 'ref',
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
        await user.click(screen.getByText('Logout'));

        expect(screen.getByTestId('user').textContent).toBe('none');
        expect(Cookies.get('ctm_access_token')).toBeUndefined();
        expect(Cookies.get('ctm_refresh_token')).toBeUndefined();
    });
});
