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

/** Drag the row sideways: right past a third of its width snoozes, left parks the delete track open. */
export const Swipeable: Story = {
    args: {
        due: { label: 'Tomorrow' },
        onSnooze: () => {},
        onDelete: () => {},
        swipeLabels: { snooze: 'Tomorrow', delete: 'Delete' },
    },
};

export const WithPriority: Story = {
    args: {
        priorityLabel: 'Priority 1',
        source: { brand: 'google_tasks', label: 'Google Tasks' },
        due: { label: '17:00' },
    },
};
