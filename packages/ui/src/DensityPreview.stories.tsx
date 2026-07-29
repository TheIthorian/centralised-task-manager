import type { Meta, StoryObj } from '@storybook/react-vite';
import { DensityPreview } from './DensityPreview.js';

const meta = {
    title: 'Composites/DensityPreview',
    component: DensityPreview,
    parameters: {
        docs: { description: { component: 'Switch the Density toolbar control to see this reflow.' } },
    },
} satisfies Meta<typeof DensityPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreeRows: Story = {
    args: {
        rows: [
            { title: 'Renew home insurance', meta: '2 days late' },
            { title: 'Review sync worker retry logic', meta: '17:00' },
            { title: 'Call the dentist back', meta: '18:30' },
        ],
    },
};
