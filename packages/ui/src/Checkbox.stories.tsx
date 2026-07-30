import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox.js';

const meta = {
    title: 'Primitives/Checkbox',
    component: Checkbox,
    args: { label: 'Renew home insurance', onChange: () => {} },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = { args: { checked: false } };
export const Checked: Story = { args: { checked: true } };
export const Disabled: Story = { args: { checked: false, disabled: true } };
