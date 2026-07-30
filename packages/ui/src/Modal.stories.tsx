import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.js';
import { Modal } from './Modal.js';

const meta = {
    title: 'Primitives/Modal',
    component: Modal,
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
    args: {
        open: true,
        onClose: () => {},
        title: 'Disconnect Todoist, Harlow Studio?',
        children: (
            <div className="flex flex-col gap-4 text-sm text-fg">
                <p>This stops syncing and removes the account&apos;s access token.</p>
                <div className="flex gap-2">
                    <Button variant="secondary">Keep connected</Button>
                    <Button variant="danger">Disconnect</Button>
                </div>
            </div>
        ),
    },
};
