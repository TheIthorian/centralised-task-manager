import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast.js';

const meta = {
    title: 'Primitives/Toast',
    component: Toast,
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithUndo: Story = { args: { message: 'Task completed', actionLabel: 'Undo', onAction: () => {} } };
export const Plain: Story = { args: { message: 'Saved view added' } };
