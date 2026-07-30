import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TaskRow } from './TaskRow.js';

const base = {
    title: 'Renew home insurance',
    source: { brand: 'todoist' as const, label: 'Todoist' },
    completed: false,
    onToggle: vi.fn(),
};

describe('TaskRow', () => {
    it('shows title, source and due state', () => {
        render(<TaskRow {...base} due={{ label: '2 days late', overdue: true }} />);

        expect(screen.getByRole('button', { name: 'Renew home insurance' })).toBeInTheDocument();
        expect(screen.getByText('Todoist')).toBeInTheDocument();
        expect(screen.getByText('2 days late')).toBeInTheDocument();
    });

    it('reports the toggled completion state', async () => {
        const onToggle = vi.fn();
        render(<TaskRow {...base} onToggle={onToggle} />);

        await userEvent.click(screen.getByRole('checkbox', { name: 'Renew home insurance' }));

        expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('blocks interaction while a write is in flight', async () => {
        const onToggle = vi.fn();
        render(<TaskRow {...base} pending onToggle={onToggle} />);

        const box = screen.getByRole('checkbox', { name: 'Renew home insurance' });

        expect(box).toBeDisabled();

        await userEvent.click(box);

        expect(onToggle).not.toHaveBeenCalled();
    });

    it('does not report completion while pending, since the server has not confirmed', () => {
        render(<TaskRow {...base} pending />);

        expect(screen.getByRole('checkbox', { name: 'Renew home insurance' })).not.toBeChecked();
    });

    it('opens the task when a handler is given', async () => {
        const onOpen = vi.fn();
        render(<TaskRow {...base} onOpen={onOpen} />);

        await userEvent.click(screen.getByRole('button', { name: 'Renew home insurance' }));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <TaskRow {...base} priorityLabel="Priority 1" due={{ label: '2 days late', overdue: true }} onOpen={vi.fn()} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
