import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.js';
import { Input } from './Input.js';
import { Sheet } from './Sheet.js';

const meta = {
    title: 'Primitives/Sheet',
    component: Sheet,
    parameters: {
        docs: {
            description: {
                component:
                    'A bottom sheet below 768px and a right side panel above it. Narrow the viewport to see the drag handle appear.',
            },
        },
    },
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
    args: {
        open: true,
        onClose: () => {},
        labelledBy: 'sheet-story-heading',
        dragHandleLabel: 'Close',
        children: (
            <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6">
                <h2 id="sheet-story-heading" className="text-base font-semibold tracking-tight text-fg">
                    Task detail
                </h2>
                <Input label="Title" defaultValue="Renew the studio insurance" />
                <Input label="Due" type="date" defaultValue="2026-08-14" />
                <div className="flex gap-2">
                    <Button variant="primary">Save</Button>
                    <Button variant="secondary">Cancel</Button>
                </div>
            </div>
        ),
    },
};
