import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandPalette } from './CommandPalette.js';
import type { CommandItem } from './CommandPalette.js';

const items: CommandItem[] = [
    { id: 'view-today', group: 'views', label: 'Today', hint: '5 tasks' },
    { id: 'view-overdue', group: 'views', label: 'Overdue', hint: '2 tasks' },
    { id: 'task-invoice', group: 'task', label: 'Send the Harlow invoice', hint: 'due today' },
    { id: 'acct-harlow', group: 'acct', label: 'Todoist, Harlow Studio' },
    { id: 'jump-cal', group: 'jump', label: 'Calendar', hint: 'G C' },
    { id: 'do-sync', group: 'do', label: 'Sync all accounts' },
];

const rows = ['Send the Harlow invoice', 'Draft the sync retry note', 'Book the studio for Thursday'];

/** Static content behind the scrim, because the blur can only be judged against real rows. */
function TaskListBackdrop(): React.JSX.Element {
    return (
        <div className="min-h-[420px] bg-bg p-6">
            <h1 className="mb-4 text-lg font-semibold tracking-tight text-fg">Today</h1>
            <ul className="divide-y divide-hair overflow-hidden rounded-ctm border border-line bg-panel">
                {rows.map((row) => (
                    <li key={row} className="flex items-center justify-between px-3.5 py-[var(--ctm-row-y)] text-[13px]">
                        <span className="text-fg">{row}</span>
                        <span className="text-[11px] text-muted">Todoist</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const meta = {
    title: 'Overlays/CommandPalette',
    component: CommandPalette,
    parameters: {
        docs: {
            description: {
                component: 'Flip the Theme toolbar control to review dark, where the scrim carries most of the contrast.',
            },
        },
    },
    decorators: [
        (Story): React.JSX.Element => (
            <>
                <TaskListBackdrop />
                <Story />
            </>
        ),
    ],
    args: {
        open: true,
        items,
        onClose: () => {},
        onRun: () => {},
        onAsk: () => {},
    },
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Actions: Story = { args: { items: items.filter((item) => item.group === 'do') } };

export const NoMatch: Story = { args: { items: [] } };
