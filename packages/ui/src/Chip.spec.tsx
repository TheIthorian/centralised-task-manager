import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip.js';

describe('Chip', () => {
    it('reports its pressed state', () => {
        render(<Chip label="Overdue" selected onToggle={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Overdue' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onToggle when clicked', async () => {
        const onToggle = vi.fn();
        render(<Chip label="Today" onToggle={onToggle} />);

        await userEvent.click(screen.getByRole('button', { name: 'Today' }));

        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('renders as static text when it has no handler', () => {
        render(<Chip label="6 shown" />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('6 shown')).toBeInTheDocument();
    });

    it('hides a decorative icon from assistive technology', () => {
        render(<Chip label="Todoist" icon={<svg data-testid="mark" />} onToggle={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Todoist' })).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Chip label="Overdue" onToggle={vi.fn()} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
