import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TaskDto } from '@ctm/api-client';
import { CalendarPage } from './CalendarPage.js';
import { toDateKey } from '../lib/calendar-range.js';
import { ToastProvider } from '../toast/ToastContext.js';

const mockApi = { listTasks: vi.fn() };

vi.mock('../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

function makeTask({ id, title, date }: { id: string; title: string; date: string }): TaskDto {
    return {
        id,
        title,
        completed: false,
        priority: 2,
        due: { date, timezone: null, recurrence: null },
        source: 'local',
        sourceId: id,
        externalAccountId: null,
        tags: [],
        locations: [],
        relations: [],
        reminders: [],
        dueDateNotifiedAt: null,
        createdAt: date,
        updatedAt: date,
    };
}

function renderPage(): void {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
        <QueryClientProvider client={qc}>
            <ToastProvider>
                <CalendarPage />
            </ToastProvider>
        </QueryClientProvider>,
    );
}

const today = new Date();
const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

describe('CalendarPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.listTasks.mockResolvedValue([
            makeTask({ id: 't1', title: 'Renew home insurance', date: toDateKey(today) }),
            makeTask({ id: 't2', title: 'Call the dentist back', date: toDateKey(tomorrow) }),
        ]);
    });

    it('opens on the month and offers the shorter ranges', async () => {
        renderPage();

        expect(await screen.findByRole('button', { name: 'Renew home insurance' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
        expect(screen.getByRole('radio', { name: '3 days' })).toBeInTheDocument();
    });

    it('narrows to a single day, dropping tasks due on other days', async () => {
        renderPage();
        await screen.findByRole('button', { name: 'Renew home insurance' });

        await userEvent.click(screen.getByRole('radio', { name: 'Day' }));

        expect(screen.getByRole('button', { name: 'Renew home insurance' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Call the dentist back' })).not.toBeInTheDocument();
    });

    it('pages by the visible range and comes back on Today', async () => {
        renderPage();
        await screen.findByRole('button', { name: 'Renew home insurance' });

        await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(screen.getByRole('button', { name: 'Call the dentist back' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Today' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Renew home insurance' })).toBeInTheDocument();
        });
    });

    it('pages with the arrow keys when no field has the keyboard', async () => {
        renderPage();
        await screen.findByRole('button', { name: 'Renew home insurance' });

        await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
        // Clicking a radio leaves it focused, and its own arrow handling comes first.
        await userEvent.click(document.body);
        await userEvent.keyboard('{ArrowRight}');

        expect(screen.getByRole('button', { name: 'Call the dentist back' })).toBeInTheDocument();

        await userEvent.keyboard('{ArrowLeft}');

        expect(screen.getByRole('button', { name: 'Renew home insurance' })).toBeInTheDocument();
    });

    it('says so when a day has nothing due', async () => {
        mockApi.listTasks.mockResolvedValue([]);
        renderPage();

        await userEvent.click(screen.getByRole('radio', { name: 'Day' }));

        expect(screen.getByText('Nothing due')).toBeInTheDocument();
    });
});
