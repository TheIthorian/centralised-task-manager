import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GroupedTaskList } from './GroupedTaskList.js';
import type { TaskDto } from '@ctm/api-client';

function makeTask(overrides: Partial<TaskDto> & { id: string }): TaskDto {
    return {
        title: `Task ${overrides.id}`,
        completed: false,
        source: 'todoist',
        sourceId: overrides.id,
        tags: [],
        locations: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

// Use a fixed past date so "overdue" is predictable
const OVERDUE_DATE = '2000-01-01';
const TODAY_DATE = new Date().toISOString().slice(0, 10);

describe('GroupedTaskList', () => {
    it('renders empty state when no tasks', () => {
        render(<GroupedTaskList tasks={[]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('No Tasks Here.')).toBeInTheDocument();
    });

    it('renders Overdue section for past-due tasks', () => {
        const task = makeTask({ id: '1', due: { date: OVERDUE_DATE, timezone: null, recurrence: null } });
        render(<GroupedTaskList tasks={[task]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/overdue/i)).toBeInTheDocument();
        expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    it('renders Today section for tasks due today', () => {
        const task = makeTask({ id: '2', due: { date: TODAY_DATE, timezone: null, recurrence: null } });
        render(<GroupedTaskList tasks={[task]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/today/i)).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('renders No Date section for tasks without due date', () => {
        const task = makeTask({ id: '3' });
        render(<GroupedTaskList tasks={[task]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/no date/i)).toBeInTheDocument();
        expect(screen.getByText('Task 3')).toBeInTheDocument();
    });

    it('hides empty sections', () => {
        const task = makeTask({ id: '4', due: { date: TODAY_DATE, timezone: null, recurrence: null } });
        render(<GroupedTaskList tasks={[task]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/no date/i)).not.toBeInTheDocument();
    });

    it('shows task count in section chip', () => {
        const tasks = [
            makeTask({ id: '5', due: { date: TODAY_DATE, timezone: null, recurrence: null } }),
            makeTask({ id: '6', due: { date: TODAY_DATE, timezone: null, recurrence: null } }),
        ];
        render(<GroupedTaskList tasks={tasks} onToggle={vi.fn()} onEdit={vi.fn()} />);
        // The count "2" appears inside the Today chip
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders Done section for completed tasks instead of their date bucket', () => {
        const task = makeTask({
            id: '7',
            completed: true,
            due: { date: TODAY_DATE, timezone: null, recurrence: null },
        });
        render(<GroupedTaskList tasks={[task]} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText(/done/i)).toBeInTheDocument();
        expect(screen.queryByText(/today/i)).not.toBeInTheDocument();
    });
});
