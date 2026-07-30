import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { LinkButton } from './LinkButton.js';

describe('LinkButton', () => {
    it('renders its label as an accessible link', () => {
        render(<LinkButton href="/signup">Get started</LinkButton>);

        expect(screen.getByRole('link', { name: 'Get started' })).toBeInTheDocument();
    });

    it('points at its href', () => {
        render(<LinkButton href="/docs">Read the docs</LinkButton>);

        expect(screen.getByRole('link', { name: 'Read the docs' })).toHaveAttribute('href', '/docs');
    });

    it('passes anchor attributes through', () => {
        render(
            <LinkButton href="https://example.com" target="_blank" rel="noreferrer">
                Open
            </LinkButton>,
        );

        expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('target', '_blank');
    });

    it('has no axe violations', async () => {
        const { container } = render(<LinkButton href="/signup">Get started</LinkButton>);

        expect(await axe(container)).toHaveNoViolations();
    });
});
