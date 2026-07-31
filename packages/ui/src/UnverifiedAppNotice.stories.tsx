import type { Meta, StoryObj } from '@storybook/react-vite';
import { UnverifiedAppNotice } from './UnverifiedAppNotice.js';

const meta = {
    title: 'Primitives/UnverifiedAppNotice',
    component: UnverifiedAppNotice,
} satisfies Meta<typeof UnverifiedAppNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        title: 'Unverified app',
        body: 'This app registered itself and its name is its own claim. Only continue if you started this.',
        hostsLabel: 'Sends you to',
        hosts: ['claude.ai'],
    },
};

export const SeveralHosts: Story = {
    args: {
        ...Default.args,
        hosts: ['claude.ai', 'localhost:4000', 'staging.example.com'],
    },
};

export const NoRegisteredHost: Story = {
    args: {
        ...Default.args,
        hosts: [],
    },
};
