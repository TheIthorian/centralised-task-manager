import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge.js';

const meta = {
    title: 'Primitives/Badge',
    component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Priority: Story = { args: { variant: 'priority', children: 'Priority 1' } };
export const Source: Story = { args: { variant: 'source', children: 'Todoist' } };
export const Neutral: Story = { args: { variant: 'neutral', children: 'local only' } };
export const Accent: Story = { args: { variant: 'accent', children: 'Verified' } };
export const Warn: Story = { args: { variant: 'warn', children: '2 days late' } };
