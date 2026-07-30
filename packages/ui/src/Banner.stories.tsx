import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner.js';
import { Button } from './Button.js';

const meta = {
    title: 'Primitives/Banner',
    component: Banner,
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConnectorTrouble: Story = {
    args: {
        tone: 'warn',
        title: 'Google Tasks needs reconnecting',
        body: 'Its token expired 2 days ago. Tasks from this account are stale until you sign in again.',
        action: <Button variant="secondary">Reconnect</Button>,
    },
};

export const Info: Story = {
    args: { tone: 'info', title: 'Syncing 3 accounts', body: 'You can leave this page, it keeps running.' },
};
