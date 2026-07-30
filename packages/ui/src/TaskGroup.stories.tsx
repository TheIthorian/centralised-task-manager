import type { Meta, StoryObj } from '@storybook/react-vite';
import { TaskGroup } from './TaskGroup.js';
import { TaskRow } from './TaskRow.js';

const meta = {
    title: 'Composites/TaskGroup',
    component: TaskGroup,
} satisfies Meta<typeof TaskGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
    args: {
        heading: 'Overdue',
        count: 2,
        emptyBody: 'Nothing overdue. Everything with a due date is still ahead of you.',
        children: (
            <>
                <TaskRow
                    title="Renew home insurance"
                    source={{ brand: 'todoist', label: 'Todoist' }}
                    due={{ label: '2 days late', overdue: true }}
                    priorityLabel="Priority 1"
                    completed={false}
                    onToggle={() => {}}
                    onOpen={() => {}}
                />
                <TaskRow
                    title="Call the dentist back"
                    source={{ brand: 'google_tasks', label: 'Google Tasks' }}
                    due={{ label: 'Yesterday', overdue: true }}
                    completed={false}
                    onToggle={() => {}}
                    onOpen={() => {}}
                />
            </>
        ),
    },
};

export const Empty: Story = {
    args: {
        heading: 'Overdue',
        count: 0,
        emptyBody: 'Nothing overdue. Everything with a due date is still ahead of you.',
    },
};
