import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
    it('renders the caller-supplied copy', () => {
        render(<EmptyState title="Nothing overdue" body="Everything with a due date is still ahead of you." />);

        expect(screen.getByText('Nothing overdue')).toBeInTheDocument();
        expect(screen.getByText('Everything with a due date is still ahead of you.')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<EmptyState title="Nothing overdue" body="Nothing to do here." />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
