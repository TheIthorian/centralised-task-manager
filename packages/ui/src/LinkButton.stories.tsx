import type { Meta, StoryObj } from '@storybook/react-vite';
import { LinkButton } from './LinkButton.js';

const meta = {
    title: 'Primitives/LinkButton',
    component: LinkButton,
    args: { href: '#' },
} satisfies Meta<typeof LinkButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: 'Get started' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'View docs' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'How it works' } };
export const Large: Story = { args: { size: 'lg', children: 'Get started' } };
