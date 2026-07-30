import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton.js';

const meta = {
    title: 'Primitives/Skeleton',
    component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeRows: Story = { args: { rows: 3 } };
export const SixRows: Story = { args: { rows: 6 } };
