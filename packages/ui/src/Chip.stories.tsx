import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './Chip.js';

const meta = {
    title: 'Primitives/Chip',
    component: Chip,
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unselected: Story = { args: { label: 'Overdue', onToggle: () => {} } };
export const Selected: Story = { args: { label: 'Overdue', selected: true, onToggle: () => {} } };
export const Static: Story = { args: { label: '6 shown' } };
