import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast.js';

describe('Toast', () => {
    it('runs its action', async () => {
        const onAction = vi.fn();
        render(<Toast message="Task completed" actionLabel="Undo" onAction={onAction} />);

        await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('announces itself politely', () => {
        render(<Toast message="Task completed" />);

        expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('has no axe violations', async () => {
        const { container } = render(<Toast message="Task completed" actionLabel="Undo" onAction={vi.fn()} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
