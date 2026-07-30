import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette.js';
import type { CommandItem } from './CommandPalette.js';

const items: CommandItem[] = [
    { id: 'jump-cal', group: 'jump', label: 'Calendar', hint: 'G C' },
    { id: 'view-today', group: 'views', label: 'Today', hint: '5 tasks' },
    { id: 'do-sync', group: 'do', label: 'Sync all accounts' },
    { id: 'acct-harlow', group: 'acct', label: 'Todoist, Harlow Studio' },
];

type Props = React.ComponentProps<typeof CommandPalette>;

function setup(overrides: Partial<Props> = {}): Props & { container: HTMLElement } {
    const props = {
        open: true,
        items,
        onClose: vi.fn(),
        onRun: vi.fn(),
        onAsk: vi.fn(),
        ...overrides,
    };
    const { container } = render(<CommandPalette {...props} />);

    return { ...props, container };
}

describe('CommandPalette', () => {
    it('is a modal dialog when open', () => {
        setup();

        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('renders nothing when closed', () => {
        setup({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('focuses the input and wires it to the listbox', () => {
        setup();
        const input = screen.getByRole('combobox');

        expect(input).toHaveFocus();
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    });

    it('keeps focus inside the dialog on Tab', async () => {
        setup();

        await userEvent.tab();

        expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('filters on the typed query', async () => {
        setup();

        await userEvent.type(screen.getByRole('combobox'), 'cal');

        expect(screen.getByRole('option', { name: /Calendar/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Sync all accounts/ })).not.toBeInTheDocument();
    });

    it('narrows to actions on the > prefix', async () => {
        setup();

        await userEvent.type(screen.getByRole('combobox'), '>');

        expect(screen.getByRole('option', { name: /Sync all accounts/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Calendar/ })).not.toBeInTheDocument();
    });

    it('narrows to views on the # prefix', async () => {
        setup();

        await userEvent.type(screen.getByRole('combobox'), '#');

        expect(screen.getByRole('option', { name: /Today/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Sync all accounts/ })).not.toBeInTheDocument();
    });

    it('narrows to accounts on the @ prefix', async () => {
        setup();

        await userEvent.type(screen.getByRole('combobox'), '@harlow');

        expect(screen.getByRole('option', { name: /Harlow Studio/ })).toBeInTheDocument();
    });

    it('runs the selected item on Enter', async () => {
        const props = setup();

        await userEvent.type(screen.getByRole('combobox'), 'cal{Enter}');

        expect(props.onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'jump-cal' }));
    });

    it('selects the first match and marks it', () => {
        setup();

        expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('moves the selection down and back up with the arrow keys', async () => {
        const props = setup();

        await userEvent.keyboard('{ArrowDown}');

        expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

        await userEvent.keyboard('{ArrowUp}{Enter}');

        expect(props.onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'view-today' }));
    });

    it('runs the item the arrow keys landed on', async () => {
        const props = setup();

        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(props.onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'acct-harlow' }));
    });

    it('hands a query that matches nothing to the agent', async () => {
        const props = setup();

        await userEvent.type(screen.getByRole('combobox'), 'what should i do first{Enter}');

        expect(props.onAsk).toHaveBeenCalledWith('what should i do first');
        expect(props.onRun).not.toHaveBeenCalled();
    });

    it('shows the no-match sentence it was given', async () => {
        setup({ labels: { noMatch: 'Rien ne correspond.' } });

        await userEvent.type(screen.getByRole('combobox'), 'zzzz');

        expect(screen.getByText('Rien ne correspond.')).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
        const props = setup();

        await userEvent.keyboard('{Escape}');

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('has no axe violations', async () => {
        const { container } = setup();

        expect(await axe(container)).toHaveNoViolations();
    });
});
