import type { Meta, StoryObj } from '@storybook/react-vite';
import { SourcePill } from './SourcePill.js';

const meta = {
    title: 'Primitives/SourcePill',
    component: SourcePill,
} satisfies Meta<typeof SourcePill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Todoist: Story = { args: { brand: 'todoist', label: 'Todoist' } };
export const GoogleTasks: Story = { args: { brand: 'google_tasks', label: 'Google Tasks' } };
