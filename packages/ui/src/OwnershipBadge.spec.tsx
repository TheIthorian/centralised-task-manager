import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { OwnershipBadge } from './OwnershipBadge.js';

describe('OwnershipBadge', () => {
    it('names the ownership in words the user can read', () => {
        render(<OwnershipBadge ownership="read-only" />);

        expect(screen.getByText('read-only')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<OwnershipBadge ownership="synced" />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
