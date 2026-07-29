import type { Meta, StoryObj } from '@storybook/react-vite';
import { OwnershipBadge } from './OwnershipBadge.js';

const meta = {
    title: 'Primitives/OwnershipBadge',
    component: OwnershipBadge,
} satisfies Meta<typeof OwnershipBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllThree: Story = {
    render: () => (
        <div className="flex gap-2">
            <OwnershipBadge ownership="synced" />
            <OwnershipBadge ownership="local" />
            <OwnershipBadge ownership="read-only" />
        </div>
    ),
};
