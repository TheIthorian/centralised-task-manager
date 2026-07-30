import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard.js';
import type { TaskDto } from '@ctm/api-client';

const baseTask: TaskDto = {
    id: '1',
    title: 'Write tests',
    completed: false,
    source: 'todoist',
    sourceId: 'x1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    priority: 1,
    tags: [],
    locations: [],
    relations: [],
    reminders: [],
    dueDateNotifiedAt: null,
};

describe('TaskCard', () => {
    it('renders task title', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Write tests')).toBeInTheDocument();
    });

    it('shows source badge', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Todoist')).toBeInTheDocument();
    });

    it('renders no source badge when source is missing', () => {
        render(<TaskCard task={{ ...baseTask, source: undefined as never }} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.queryByText('Todoist')).not.toBeInTheDocument();
        expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('names the priority rather than abbreviating it', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Priority 1')).toBeInTheDocument();
    });

    it('calls onToggle when checkbox clicked', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();

        render(<TaskCard task={baseTask} onToggle={onToggle} onEdit={vi.fn()} />);
        await user.click(screen.getByRole('checkbox'));

        expect(onToggle).toHaveBeenCalledWith('1', true);
    });

    it('renders completed task with strikethrough', () => {
        const completedTask = { ...baseTask, completed: true };

        render(<TaskCard task={completedTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Write tests')).toHaveClass('line-through');
    });
});
