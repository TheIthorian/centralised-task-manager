import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.js';

const meta = {
    title: 'Primitives/Button',
    component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: 'Sync now' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Change what syncs' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Stay read-only' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Disconnect' } };
export const Disabled: Story = { args: { disabled: true, children: 'Sync now' } };
