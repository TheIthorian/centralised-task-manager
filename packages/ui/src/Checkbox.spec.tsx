import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox.js';

describe('Checkbox', () => {
    it('exposes its checked state to assistive technology', () => {
        render(<Checkbox checked onChange={vi.fn()} label="Renew home insurance" />);

        expect(screen.getByRole('checkbox', { name: 'Renew home insurance' })).toBeChecked();
    });

    it('reports the toggled value', async () => {
        const onChange = vi.fn();
        render(<Checkbox checked={false} onChange={onChange} label="Call the dentist back" />);

        await userEvent.click(screen.getByRole('checkbox', { name: 'Call the dentist back' }));

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('does not fire when disabled', async () => {
        const onChange = vi.fn();
        render(<Checkbox checked={false} disabled onChange={onChange} label="Draft release notes" />);

        await userEvent.click(screen.getByRole('checkbox', { name: 'Draft release notes' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('has no axe violations', async () => {
        const { container } = render(<Checkbox checked onChange={vi.fn()} label="Renew home insurance" />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
