import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.js';
import { EmptyState } from './EmptyState.js';

const meta = {
    title: 'Primitives/EmptyState',
    component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NothingOverdue: Story = {
    args: { title: 'Nothing overdue', body: 'Everything with a due date is still ahead of you.' },
};

export const WithAction: Story = {
    args: {
        title: 'No accounts connected',
        body: 'Link an account and your tasks appear here within a minute.',
        action: <Button>Connect account</Button>,
    },
};
