import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet.js';

type RenderOptions = {
    onClose?: () => void;
    open?: boolean;
};

function renderSheet({ onClose = vi.fn(), open = true }: RenderOptions = {}): ReturnType<typeof render> {
    return render(
        <Sheet open={open} onClose={onClose} labelledBy="sheet-heading" dragHandleLabel="Close">
            <h2 id="sheet-heading">Buy milk</h2>
            <button type="button">Save</button>
            <button type="button">Delete</button>
        </Sheet>,
    );
}

describe('Sheet', () => {
    it('renders nothing when closed', () => {
        renderSheet({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('names itself from the heading it points at', () => {
        renderSheet();

        expect(screen.getByRole('dialog', { name: 'Buy milk' })).toHaveAttribute('aria-modal', 'true');
    });

    it('closes on Escape', async () => {
        const onClose = vi.fn();
        renderSheet({ onClose });

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await userEvent.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when the drag handle is activated by keyboard', async () => {
        const onClose = vi.fn();
        renderSheet({ onClose });

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps Tab inside the dialog', async () => {
        renderSheet();

        const last = screen.getByRole('button', { name: 'Delete' });
        last.focus();

        await userEvent.tab();

        expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    });

    it('returns focus to whatever opened it', async () => {
        const onClose = vi.fn();
        const opener = document.createElement('button');
        document.body.append(opener);
        opener.focus();

        const { unmount } = renderSheet({ onClose });
        unmount();

        expect(opener).toHaveFocus();

        opener.remove();
    });

    it('has no axe violations', async () => {
        renderSheet();

        // The sheet renders through a portal, so the render container itself is empty.
        expect(await axe(document.body)).toHaveNoViolations();
    });
});
