import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar, type FilterBarProps } from './FilterBar.js';
import type { Condition } from '../../lib/task-conditions.js';

function renderBar(overrides: Partial<FilterBarProps> = {}): {
    onToggleCondition: (condition: Condition) => void;
    onClearConditions: () => void;
    onApplySearch: (search: string) => void;
} {
    const onToggleCondition = vi.fn();
    const onClearConditions = vi.fn();
    const onApplySearch = vi.fn();

    render(
        <FilterBar
            filter="all"
            onFilterChange={vi.fn()}
            conditions={[]}
            onToggleCondition={onToggleCondition}
            onClearConditions={onClearConditions}
            sources={['local', 'todoist']}
            search="due=overdue"
            onApplySearch={onApplySearch}
            {...overrides}
        />,
    );

    return { onToggleCondition, onClearConditions, onApplySearch };
}

async function openMenu(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
}

describe('FilterBar', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('keeps the server side slices as chips and puts the conditions behind one menu', () => {
        renderBar();

        expect(screen.getByRole('button', { name: 'Upcoming' })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Overdue' })).not.toBeInTheDocument();
    });

    it('reports which conditions are applied', async () => {
        renderBar({ conditions: [{ kind: 'due', value: 'overdue' }] });

        await openMenu();

        expect(screen.getByRole('checkbox', { name: 'Overdue' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'No due date' })).not.toBeChecked();
    });

    it('only offers sources that are actually present', async () => {
        renderBar();

        await openMenu();

        expect(screen.getByRole('checkbox', { name: 'Todoist' })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Google Tasks' })).not.toBeInTheDocument();
    });

    it('hands the toggled condition back rather than filtering itself', async () => {
        const { onToggleCondition } = renderBar();

        await openMenu();
        await userEvent.click(screen.getByRole('checkbox', { name: 'Due today' }));

        expect(onToggleCondition).toHaveBeenCalledWith({ kind: 'due', value: 'today' });
    });

    it('clears everything from inside the menu', async () => {
        const { onClearConditions } = renderBar({ conditions: [{ kind: 'due', value: 'overdue' }] });

        await openMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

        expect(onClearConditions).toHaveBeenCalled();
    });

    it('offers to save a view only once something is filtered', () => {
        renderBar();

        expect(screen.queryByRole('button', { name: 'Save as view' })).not.toBeInTheDocument();
    });

    it('saves, restores and removes a view', async () => {
        const { onApplySearch } = renderBar({ conditions: [{ kind: 'due', value: 'overdue' }] });

        await userEvent.click(screen.getByRole('button', { name: 'Save as view' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Name this view' }), 'Late');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await userEvent.click(screen.getByRole('button', { name: 'Late' }));
        expect(onApplySearch).toHaveBeenCalledWith('due=overdue');

        await userEvent.click(screen.getByRole('button', { name: 'Remove view Late' }));
        expect(screen.queryByRole('button', { name: 'Late' })).not.toBeInTheDocument();
    });

    it('survives local storage holding something that is not a view', () => {
        localStorage.setItem('ctm.views', '{"nope":true}');

        renderBar();

        expect(screen.getByRole('button', { name: /Filter/ })).toBeInTheDocument();
    });
});
