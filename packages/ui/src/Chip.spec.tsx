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

    it('removes without also toggling', async () => {
        const onToggle = vi.fn();
        const onRemove = vi.fn();

        render(
            <Chip label="Late" onToggle={onToggle} onRemove={onRemove} removeLabel="Remove view Late" />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Remove view Late' }));

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('keeps both of its controls reachable by keyboard', async () => {
        render(<Chip label="Late" onToggle={vi.fn()} onRemove={vi.fn()} removeLabel="Remove view Late" />);

        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Late' })).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByRole('button', { name: 'Remove view Late' })).toHaveFocus();
    });

    it('reports its pressed state in either tone', () => {
        render(<Chip label="Late" tone="subtle" selected onToggle={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('has no axe violations', async () => {
        const { container } = render(<Chip label="Overdue" onToggle={vi.fn()} />);

        expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations with a remove control', async () => {
        const { container } = render(
            <Chip label="Late" onToggle={vi.fn()} onRemove={vi.fn()} removeLabel="Remove view Late" />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
