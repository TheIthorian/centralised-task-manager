import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar, type FilterBarProps } from './FilterBar.js';
import type { Condition } from '../../lib/task-conditions.js';

function renderBar(overrides: Partial<FilterBarProps> = {}): {
    onToggleCondition: (condition: Condition) => void;
    onClearConditions: () => void;
} {
    const onToggleCondition = vi.fn();
    const onClearConditions = vi.fn();

    render(
        <FilterBar
            filter="all"
            onFilterChange={vi.fn()}
            conditions={[]}
            onToggleCondition={onToggleCondition}
            onClearConditions={onClearConditions}
            sources={['local', 'todoist']}
            onNewTask={vi.fn()}
            {...overrides}
        />,
    );

    return { onToggleCondition, onClearConditions };
}

async function openMenu(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
}

describe('FilterBar', () => {
    it('keeps the server side slices as one control and puts the conditions behind a menu', () => {
        renderBar();

        expect(screen.getByRole('radio', { name: 'Upcoming' })).toBeInTheDocument();
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

    it('opens the add form from the row', async () => {
        const onNewTask = vi.fn();

        render(
            <FilterBar
                filter="all"
                onFilterChange={vi.fn()}
                conditions={[]}
                onToggleCondition={vi.fn()}
                onClearConditions={vi.fn()}
                sources={[]}
                onNewTask={onNewTask}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'New task' }));

        expect(onNewTask).toHaveBeenCalled();
    });

});
