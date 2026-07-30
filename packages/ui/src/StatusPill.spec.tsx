import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill.js';

describe('StatusPill', () => {
    it('states the status in words, not only in colour', () => {
        render(<StatusPill status="warn">Reconnect</StatusPill>);

        expect(screen.getByText('Reconnect')).toBeInTheDocument();
    });

    it('has no axe violations', async () => {
        const { container } = render(<StatusPill status="ok">Connected</StatusPill>);

        expect(await axe(container)).toHaveNoViolations();
    });
});
