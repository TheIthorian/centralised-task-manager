import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { FilterMenu, type FilterGroup } from './FilterMenu.js';

const groups: FilterGroup[] = [
    {
        id: 'due',
        label: 'Due',
        options: [
            { value: 'overdue', label: 'Overdue', checked: true },
            { value: 'today', label: 'Due today', checked: false },
        ],
    },
    {
        id: 'source',
        label: 'Source',
        options: [{ value: 'todoist', label: 'Todoist', checked: false }],
    },
];

function renderMenu(overrides: Partial<React.ComponentProps<typeof FilterMenu>> = {}): {
    onToggle: ReturnType<typeof vi.fn>;
    onClear: ReturnType<typeof vi.fn>;
    container: HTMLElement;
} {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    const { container } = render(
        <FilterMenu
            label="Filter"
            groups={groups}
            onToggle={onToggle}
            onClear={onClear}
            clearLabel="Clear filters"
            {...overrides}
        />,
    );

    return { onToggle, onClear, container };
}

describe('FilterMenu', () => {
    it('stays closed until asked, and says so', async () => {
        renderMenu();

        const trigger = screen.getByRole('button', { name: /Filter/ });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('checkbox', { name: 'Overdue' })).not.toBeInTheDocument();

        await userEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('checkbox', { name: 'Overdue' })).toBeChecked();
    });

    it('counts what is applied on the trigger', () => {
        renderMenu();

        expect(screen.getByRole('button', { name: /Filter/ })).toHaveTextContent('1');
    });

    it('reports a toggle with its group, and keeps the menu open for the next one', async () => {
        const { onToggle } = renderMenu();

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        await userEvent.click(screen.getByRole('checkbox', { name: 'Due today' }));

        expect(onToggle).toHaveBeenCalledWith({ groupId: 'due', value: 'today' });
        expect(screen.getByRole('checkbox', { name: 'Todoist' })).toBeInTheDocument();
    });

    it('offers to clear only when something is applied', async () => {
        renderMenu();

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });

    it('hides the clear action when nothing is applied', async () => {
        const empty = groups.map((group) => ({
            ...group,
            options: group.options.map((option) => ({ ...option, checked: false })),
        }));

        renderMenu({ groups: empty });

        await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

        expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('closes on escape and on a click outside', async () => {
        renderMenu();

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('checkbox', { name: 'Overdue' })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        await userEvent.click(document.body);
        expect(screen.queryByRole('checkbox', { name: 'Overdue' })).not.toBeInTheDocument();
    });

    it('names and saves the current selection from the footer', async () => {
        const onSaveView = vi.fn();

        renderMenu({
            onSaveView,
            labels: { saveView: 'Save as view', viewName: 'Name this view', save: 'Save' },
        });

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Save as view' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Name this view' }), '  Late  ');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSaveView).toHaveBeenCalledWith('Late');
    });

    it('will not save a view with no name', async () => {
        const onSaveView = vi.fn();

        renderMenu({
            onSaveView,
            labels: { saveView: 'Save as view', viewName: 'Name this view', save: 'Save' },
        });

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Save as view' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSaveView).not.toHaveBeenCalled();
    });

    it('has no accessibility violations while open', async () => {
        const { container } = renderMenu();

        await userEvent.click(screen.getByRole('button', { name: /Filter/ }));

        expect(await axe(container)).toHaveNoViolations();
    });
});
