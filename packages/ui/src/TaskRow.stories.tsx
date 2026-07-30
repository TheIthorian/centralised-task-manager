import type { Meta, StoryObj } from '@storybook/react-vite';
import { TaskRow } from './TaskRow.js';

const meta = {
    title: 'Composites/TaskRow',
    component: TaskRow,
    args: {
        title: 'Renew home insurance',
        source: { brand: 'todoist', label: 'Todoist' },
        completed: false,
        onToggle: () => {},
        onOpen: () => {},
    },
} satisfies Meta<typeof TaskRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { due: { label: 'Tomorrow' } } };
export const Overdue: Story = { args: { due: { label: '2 days late', overdue: true } } };
export const Pending: Story = { args: { pending: true, due: { label: 'Tomorrow' } } };
export const Completed: Story = { args: { completed: true } };

export const WithPriority: Story = {
    args: {
        priorityLabel: 'Priority 1',
        source: { brand: 'google_tasks', label: 'Google Tasks' },
        due: { label: '17:00' },
    },
};
