import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input.js';

const meta = {
    title: 'Primitives/Input',
    component: Input,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: 'View name', placeholder: 'Deep work' } };
export const WithError: Story = { args: { label: 'View name', error: 'Give the view a name' } };
