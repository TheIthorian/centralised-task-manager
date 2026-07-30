import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar, type FilterBarProps } from './FilterBar.js';
import type { Condition } from '../../lib/task-conditions.js';

function renderBar(overrides: Partial<FilterBarProps> = {}): {
    onToggleCondition: (condition: Condition) => void;
    onApplySearch: (search: string) => void;
} {
    const onToggleCondition = vi.fn();
    const onApplySearch = vi.fn();

    render(
        <FilterBar
            filter="all"
            onFilterChange={vi.fn()}
            conditions={[]}
            onToggleCondition={onToggleCondition}
            sources={['local', 'todoist']}
            search="due=overdue"
            onApplySearch={onApplySearch}
            {...overrides}
        />,
    );

    return { onToggleCondition, onApplySearch };
}

describe('FilterBar', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('offers a chip per condition and reports which are applied', () => {
        renderBar({ conditions: [{ kind: 'due', value: 'overdue' }] });

        expect(screen.getByRole('button', { name: 'Overdue' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'No due date' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('only offers sources that are actually present', () => {
        renderBar();

        expect(screen.getByRole('button', { name: 'Todoist' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Google Tasks' })).not.toBeInTheDocument();
    });

    it('hands the toggled condition back rather than filtering itself', async () => {
        const { onToggleCondition } = renderBar();

        await userEvent.click(screen.getByRole('button', { name: 'Due today' }));

        expect(onToggleCondition).toHaveBeenCalledWith({ kind: 'due', value: 'today' });
    });

    it('offers to save a view only once something is filtered', async () => {
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

        expect(screen.getByRole('button', { name: 'Overdue' })).toBeInTheDocument();
    });
});
