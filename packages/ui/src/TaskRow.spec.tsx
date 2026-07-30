import { fireEvent, render, screen } from '@testing-library/react';
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

const swipeLabels = { snooze: 'Tomorrow', delete: 'Delete' };

/** The gesture surface is the row body, which is the element holding the title button. */
function rowBody(): HTMLElement {
    const body = screen.getByRole('button', { name: 'Renew home insurance' }).parentElement;

    if (!body) throw new Error('row body not found');

    return body;
}

function swipe({ to }: { to: number }): void {
    const body = rowBody();

    fireEvent.pointerDown(body, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(body, { clientX: to / 2, clientY: 0 });
    fireEvent.pointerMove(body, { clientX: to, clientY: 0 });
    fireEvent.pointerUp(body);
}

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

    it('snoozes when a swipe right is released past the threshold', () => {
        const onSnooze = vi.fn();
        render(<TaskRow {...base} onSnooze={onSnooze} onDelete={vi.fn()} swipeLabels={swipeLabels} />);

        swipe({ to: 140 });

        expect(onSnooze).toHaveBeenCalledTimes(1);
    });

    it('springs back instead of snoozing when the swipe is short', () => {
        const onSnooze = vi.fn();
        render(<TaskRow {...base} onSnooze={onSnooze} onDelete={vi.fn()} swipeLabels={swipeLabels} />);

        swipe({ to: 40 });

        expect(onSnooze).not.toHaveBeenCalled();
    });

    it('ignores a gesture that starts vertical, so the list still scrolls', () => {
        const onSnooze = vi.fn();
        render(<TaskRow {...base} onSnooze={onSnooze} onDelete={vi.fn()} swipeLabels={swipeLabels} />);

        const body = rowBody();
        fireEvent.pointerDown(body, { clientX: 0, clientY: 0 });
        fireEvent.pointerMove(body, { clientX: 10, clientY: 40 });
        fireEvent.pointerMove(body, { clientX: 140, clientY: 40 });
        fireEvent.pointerUp(body);

        expect(onSnooze).not.toHaveBeenCalled();
    });

    it('reveals delete on a swipe left without deleting anything', () => {
        const onDelete = vi.fn();
        render(<TaskRow {...base} onSnooze={vi.fn()} onDelete={onDelete} swipeLabels={swipeLabels} />);

        swipe({ to: -140 });

        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('deletes only when the revealed button is pressed', async () => {
        const onDelete = vi.fn();
        render(<TaskRow {...base} onSnooze={vi.fn()} onDelete={onDelete} swipeLabels={swipeLabels} />);

        swipe({ to: -140 });
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('keeps the delete track out of the tab order until it is revealed', () => {
        render(<TaskRow {...base} onSnooze={vi.fn()} onDelete={vi.fn()} swipeLabels={swipeLabels} />);

        expect(screen.getByText('Delete')).toHaveAttribute('tabindex', '-1');
    });

    it('does not swipe while a write is in flight', () => {
        const onSnooze = vi.fn();
        render(<TaskRow {...base} pending onSnooze={onSnooze} onDelete={vi.fn()} swipeLabels={swipeLabels} />);

        swipe({ to: 140 });

        expect(onSnooze).not.toHaveBeenCalled();
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <TaskRow {...base} priorityLabel="Priority 1" due={{ label: '2 days late', overdue: true }} onOpen={vi.fn()} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
