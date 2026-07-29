import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.js';

const options = [
    { value: 'compact' as const, label: 'Compact' },
    { value: 'comfortable' as const, label: 'Comfortable' },
    { value: 'spacious' as const, label: 'Spacious' },
];

describe('SegmentedControl', () => {
    it('is a labelled radio group with the current value checked', () => {
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={vi.fn()} />);

        expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Comfortable' })).toBeChecked();
    });

    it('reports the chosen value', async () => {
        const onChange = vi.fn();
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={onChange} />);

        await userEvent.click(screen.getByRole('radio', { name: 'Spacious' }));

        expect(onChange).toHaveBeenCalledWith('spacious');
    });

    it('moves between options with the arrow keys', async () => {
        const onChange = vi.fn();
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={onChange} />);

        screen.getByRole('radio', { name: 'Comfortable' }).focus();
        await userEvent.keyboard('{ArrowRight}');

        expect(onChange).toHaveBeenCalledWith('spacious');
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <SegmentedControl label="Density" options={options} value="compact" onChange={vi.fn()} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
