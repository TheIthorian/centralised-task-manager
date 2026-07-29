import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './Kbd.js';

const meta = {
    title: 'Primitives/Kbd',
    component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = { args: { children: '⌘K' } };
export const Chord: Story = {
    render: () => (
        <span className="flex items-center gap-1.5 text-xs text-muted">
            <Kbd>G</Kbd> then <Kbd>T</Kbd> goes to Tasks
        </span>
    ),
};
