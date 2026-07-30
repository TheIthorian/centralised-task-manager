import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
    it('associates the label with the field', () => {
        render(<Input label="View name" />);

        expect(screen.getByLabelText('View name')).toBeInTheDocument();
    });

    it('describes the field with its error', () => {
        render(<Input label="View name" error="Give the view a name" />);

        expect(screen.getByLabelText('View name')).toHaveAccessibleDescription('Give the view a name');
    });

    it('accepts typing', async () => {
        render(<Input label="View name" />);

        await userEvent.type(screen.getByLabelText('View name'), 'Deep work');

        expect(screen.getByLabelText('View name')).toHaveValue('Deep work');
    });

    it('has no axe violations', async () => {
        const { container } = render(<Input label="View name" />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
