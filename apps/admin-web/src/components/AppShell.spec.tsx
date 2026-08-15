import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell.js';
import { ThemeProvider } from '../theme/ThemeContext.js';
import { renderPage } from '../test-utils.js';

function render(getIdentity = vi.fn().mockResolvedValue({ email: 'ops@example.com', subject: 'sub-1' })): void {
    renderPage({
        ui: (
            <ThemeProvider>
                <AppShell />
            </ThemeProvider>
        ),
        client: { getIdentity },
    });
}

describe('AppShell', () => {
    it('names the operator Access authenticated, so a destructive action has an owner', async () => {
        render();

        expect(await screen.findByText('Signed in as ops@example.com')).toBeInTheDocument();
    });

    it('says the identity is unavailable rather than showing a blank name', async () => {
        render(vi.fn().mockRejectedValue(new Error('identity endpoint is down')));

        expect(await screen.findByText('Identity unavailable')).toBeInTheDocument();
    });

    it('links the three console sections', () => {
        render();

        expect(screen.getByRole('link', { name: 'Deployment' })).toHaveAttribute('href', '/dashboard');
        expect(screen.getByRole('link', { name: 'OAuth clients' })).toHaveAttribute('href', '/clients');
        expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
    });

    it('signs out through Access, which owns the session', () => {
        render();

        expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/cdn-cgi/access/logout');
    });
});
