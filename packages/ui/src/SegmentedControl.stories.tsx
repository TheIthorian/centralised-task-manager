import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl.js';

const meta = {
    title: 'Primitives/SegmentedControl',
    component: SegmentedControl,
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Density: Story = {
    render: () => {
        const [value, setValue] = useState('comfortable');

        return (
            <SegmentedControl
                label="Density"
                value={value}
                onChange={setValue}
                options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'spacious', label: 'Spacious' },
                ]}
            />
        );
    },
};
