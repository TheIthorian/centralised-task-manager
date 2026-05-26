import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { NotificationsPage } from './NotificationsPage.js';

const mockPrefs = {
    connectorReconnect: { inApp: true, discord: false, email: false },
    dailySummary: { inApp: true, discord: false, email: false },
    reminder: { inApp: false, discord: false, email: false },
    upcomingDeadline: { inApp: true, discord: false, email: false },
};

const mockApi = {
    getNotificationPreferences: vi.fn(),
    getDiscordStatus: vi.fn(),
    updateNotificationPreferences: vi.fn(),
};

const mockShowToast = vi.fn();

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

vi.mock('../toast/ToastContext.js', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}));

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
        <MemoryRouter>
            <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </MemoryRouter>
    );
}

describe('NotificationsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.getNotificationPreferences.mockResolvedValue(mockPrefs);
        mockApi.getDiscordStatus.mockResolvedValue({ connected: false });
    });

    it('renders all notification type rows', async () => {
        render(<NotificationsPage />, { wrapper });
        await waitFor(() => {
            expect(screen.getByText('Connector Reconnect')).toBeInTheDocument();
            expect(screen.getByText('Daily Summary')).toBeInTheDocument();
            expect(screen.getByText('Reminder')).toBeInTheDocument();
            expect(screen.getByText('Upcoming Deadline')).toBeInTheDocument();
        });
    });

    it('renders column headers', async () => {
        render(<NotificationsPage />, { wrapper });
        await waitFor(() => {
            expect(screen.getByText('In-App')).toBeInTheDocument();
            expect(screen.getByText('Email')).toBeInTheDocument();
        });
    });

    it('shows Connect link when discord not connected', async () => {
        render(<NotificationsPage />, { wrapper });
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /connect/i })).toBeInTheDocument();
        });
    });

    it('calls updateNotificationPreferences on toggle', async () => {
        mockApi.updateNotificationPreferences.mockResolvedValue({
            ...mockPrefs,
            reminder: { inApp: true, discord: false, email: false },
        });
        render(<NotificationsPage />, { wrapper });

        await waitFor(() => screen.getByText('Reminder'));

        const reminderInAppCheckbox = screen.getByRole('checkbox', {
            name: /reminder via inApp/i,
        });
        await userEvent.click(reminderInAppCheckbox);

        await waitFor(() => {
            expect(mockApi.updateNotificationPreferences).toHaveBeenCalledWith({
                dto: { reminder: { inApp: true } },
            });
        });
    });

    it('shows error message when preferences fail to load', async () => {
        mockApi.getNotificationPreferences.mockRejectedValue(new Error('Network error'));
        render(<NotificationsPage />, { wrapper });
        await waitFor(() => {
            expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
        });
    });

    it('shows toast on mutation error', async () => {
        mockApi.updateNotificationPreferences.mockRejectedValue(new Error('Save failed'));
        render(<NotificationsPage />, { wrapper });

        await waitFor(() => screen.getByText('Reminder'));

        const reminderInAppCheckbox = screen.getByRole('checkbox', {
            name: /reminder via inApp/i,
        });
        await userEvent.click(reminderInAppCheckbox);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'Error',
                description: 'Failed to save preferences',
            });
        });
    });
});
