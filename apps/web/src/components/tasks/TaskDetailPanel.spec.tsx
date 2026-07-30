import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TaskDto } from '@ctm/api-client';
import { TaskDetailPanel } from './TaskDetailPanel.js';
import { ToastProvider } from '../../toast/ToastContext.js';

const mockApi = { listTasks: vi.fn(), addReminder: vi.fn(), removeReminder: vi.fn() };

vi.mock('../../auth/AuthContext.js', () => ({
    useAuth: () => ({ api: mockApi }),
}));

function makeTask(overrides: Partial<TaskDto> = {}): TaskDto {
    return {
        id: 't1',
        title: 'Renew home insurance',
        description: 'Compare two quotes first',
        completed: false,
        priority: 2,
        due: { date: '2026-08-01T09:00:00.000Z', timezone: null, recurrence: null },
        deadlineDate: null,
        duration: null,
        fuzzyDeadline: null,
        source: 'local',
        sourceId: 't1',
        externalAccountId: null,
        tags: [],
        locations: [],
        relations: [],
        reminders: [],
        dueDateNotifiedAt: null,
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
        ...overrides,
    };
}

type Handlers = {
    onClose: ReturnType<typeof vi.fn>;
    onSave: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onSetFuzzyDeadline: ReturnType<typeof vi.fn>;
};

function renderPanel(task: TaskDto = makeTask()): Handlers {
    const handlers: Handlers = {
        onClose: vi.fn(),
        onSave: vi.fn().mockResolvedValue(undefined),
        onDelete: vi.fn().mockResolvedValue(undefined),
        onSetFuzzyDeadline: vi.fn().mockResolvedValue(undefined),
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
        <QueryClientProvider client={qc}>
            <ToastProvider>
                <TaskDetailPanel task={task} open={true} {...handlers} />
            </ToastProvider>
        </QueryClientProvider>,
    );

    return handlers;
}

describe('TaskDetailPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.listTasks.mockResolvedValue([]);
    });

    it('shows the task in a labelled dialog', () => {
        renderPanel();

        expect(screen.getByRole('dialog', { name: 'Task detail' })).toBeInTheDocument();
        expect(screen.getByLabelText('Title')).toHaveValue('Renew home insurance');
        expect(screen.getByLabelText('Description')).toHaveValue('Compare two quotes first');
        expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
    });

    it('closes on Escape', async () => {
        const { onClose } = renderPanel();

        await userEvent.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalled();
    });

    it('closes from the header button', async () => {
        const { onClose } = renderPanel();

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });

    it('closes when the scrim is clicked', async () => {
        const { onClose } = renderPanel();
        // The scrim carries no role on purpose, so the dialog is the only thing screen
        // readers see. Clicking it is still how a pointer user dismisses the panel.
        const scrim = document.querySelector('[aria-hidden="true"]');

        expect(scrim).toBeInstanceOf(HTMLElement);

        if (!(scrim instanceof HTMLElement)) return;

        await userEvent.click(scrim);

        expect(onClose).toHaveBeenCalled();
    });

    it('saves the edited values', async () => {
        const { onSave, onSetFuzzyDeadline } = renderPanel();

        await userEvent.clear(screen.getByLabelText('Title'));
        await userEvent.type(screen.getByLabelText('Title'), 'Renew car insurance');
        await userEvent.click(screen.getByRole('radio', { name: 'P1' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                't1',
                expect.objectContaining({ title: 'Renew car insurance', priority: 1 }),
            );
        });
        expect(onSetFuzzyDeadline).toHaveBeenCalledWith('t1', { type: 'this_week', remindEvery: undefined });
    });

    it('asks for confirmation before deleting', async () => {
        const { onDelete } = renderPanel();

        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByText('Press delete again to remove this task permanently.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

        await waitFor(() => expect(onDelete).toHaveBeenCalledWith('t1'));
    });

    it('marks the fields of a local task as local', () => {
        renderPanel();

        expect(screen.getAllByText('local').length).toBeGreaterThan(0);
        expect(screen.queryByText('synced')).not.toBeInTheDocument();
    });

    it('marks the fields of a connector task as synced', () => {
        renderPanel(makeTask({ source: 'todoist' }));

        expect(screen.getAllByText('synced').length).toBeGreaterThan(0);
        expect(screen.queryByText('local')).not.toBeInTheDocument();
    });
});
