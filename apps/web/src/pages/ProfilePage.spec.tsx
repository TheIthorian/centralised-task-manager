import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfilePage } from './ProfilePage.js';

// Mock api-client
vi.mock('@ctm/api-client', () => ({
    updateMe: vi.fn(),
    deleteMe: vi.fn(),
}));

// Mock AuthContext
const mockLogout = vi.fn();
vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        logout: mockLogout,
    }),
}));

import { updateMe, deleteMe } from '@ctm/api-client';

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user email in the update form', () => {
        render(<ProfilePage />, { wrapper });
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });

    it('calls updateMe with new email on save', async () => {
        vi.mocked(updateMe).mockResolvedValue({ id: '1', email: 'new@example.com' });
        render(<ProfilePage />, { wrapper });

        const emailInput = screen.getByDisplayValue('test@example.com');
        await userEvent.clear(emailInput);
        await userEvent.type(emailInput, 'new@example.com');
        await userEvent.click(screen.getByRole('button', { name: /save/i }));

        await waitFor(() => {
            expect(updateMe).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
        });
    });

    it('requires typed email confirmation before deleting account', async () => {
        render(<ProfilePage />, { wrapper });

        const deleteBtn = screen.getByRole('button', { name: /delete account/i });
        await userEvent.click(deleteBtn);

        // Confirmation input should appear
        expect(screen.getByPlaceholderText(/type your email/i)).toBeInTheDocument();
        // deleteMe should NOT have been called yet
        expect(deleteMe).not.toHaveBeenCalled();
    });

    it('calls deleteMe and logout after email confirmation', async () => {
        vi.mocked(deleteMe).mockResolvedValue(undefined);
        render(<ProfilePage />, { wrapper });

        await userEvent.click(screen.getByRole('button', { name: /delete account/i }));

        const confirmInput = screen.getByPlaceholderText(/type your email/i);
        await userEvent.type(confirmInput, 'test@example.com');
        await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

        await waitFor(() => {
            expect(deleteMe).toHaveBeenCalled();
            expect(mockLogout).toHaveBeenCalled();
        });
    });
});
