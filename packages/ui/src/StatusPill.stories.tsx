import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusPill } from './StatusPill.js';

const meta = {
    title: 'Primitives/StatusPill',
    component: StatusPill,
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = { args: { status: 'ok', children: 'Connected' } };
export const NeedsYou: Story = { args: { status: 'warn', children: 'Reconnect' } };
export const Queued: Story = { args: { status: 'neutral', children: 'Queued' } };
