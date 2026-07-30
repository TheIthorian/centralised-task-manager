import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterMenu } from './FilterMenu.js';

const meta = {
    title: 'Primitives/FilterMenu',
    component: FilterMenu,
} satisfies Meta<typeof FilterMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

const CATALOGUE = [
    {
        id: 'due',
        label: 'Due',
        options: [
            { value: 'overdue', label: 'Overdue' },
            { value: 'today', label: 'Due today' },
            { value: 'week', label: 'This week' },
            { value: 'none', label: 'No date' },
        ],
    },
    {
        id: 'field',
        label: 'Missing',
        options: [
            { value: 'noDate', label: 'No due date' },
            { value: 'noDuration', label: 'No duration' },
            { value: 'hasReminder', label: 'Has a reminder' },
        ],
    },
    {
        id: 'source',
        label: 'Source',
        options: [
            { value: 'local', label: 'In app' },
            { value: 'todoist', label: 'Todoist' },
        ],
    },
];

export const TaskFilters: Story = {
    render: () => {
        const [applied, setApplied] = useState<string[]>(['due:overdue']);

        const toggle = ({ groupId, value }: { groupId: string; value: string }): void => {
            const key = `${groupId}:${value}`;

            setApplied((current) =>
                current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
            );
        };

        return (
            <FilterMenu
                label="Filter"
                clearLabel="Clear filters"
                onToggle={toggle}
                onClear={() => setApplied([])}
                groups={CATALOGUE.map((group) => ({
                    ...group,
                    options: group.options.map((option) => ({
                        ...option,
                        checked: applied.includes(`${group.id}:${option.value}`),
                    })),
                }))}
            />
        );
    },
};
