import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuditLogEntryDto } from '@ctm/api-client';
import { AuditLogPage } from './AuditLogPage.js';
import { renderPage } from '../test-utils.js';

function entry(overrides: Partial<AuditLogEntryDto> = {}): AuditLogEntryDto {
    return {
        id: 'entry-1',
        action: 'oauth_client.updated',
        actor: 'ops@example.com',
        targetType: 'oauth_client',
        targetId: 'dyn-1',
        targetLabel: 'Notes App',
        ip: '203.0.113.7',
        metadata: { changed: ['scopes'] },
        createdAt: '2026-08-15T09:30:00.000Z',
        ...overrides,
    };
}

describe('AuditLogPage', () => {
    it('shows the action, the operator and the target label', async () => {
        renderPage({
            ui: <AuditLogPage />,
            client: { listAuditLog: vi.fn().mockResolvedValue({ entries: [entry()], total: 1 }) },
        });

        expect(await screen.findByText('oauth_client.updated')).toBeInTheDocument();
        expect(screen.getByText('by ops@example.com')).toBeInTheDocument();
        expect(screen.getByText('on Notes App')).toBeInTheDocument();
    });

    it('renders the recorded metadata, which is what says exactly what changed', async () => {
        renderPage({
            ui: <AuditLogPage />,
            client: { listAuditLog: vi.fn().mockResolvedValue({ entries: [entry()], total: 1 }) },
        });

        expect(await screen.findByText('changed')).toBeInTheDocument();
        expect(screen.getByText('["scopes"]')).toBeInTheDocument();
    });

    it('omits the target line for an entry that has no label', async () => {
        const unlabelled = entry({ targetLabel: null, ip: null });

        renderPage({
            ui: <AuditLogPage />,
            client: { listAuditLog: vi.fn().mockResolvedValue({ entries: [unlabelled], total: 1 }) },
        });

        await screen.findByText('oauth_client.updated');

        expect(screen.queryByText(/^on /)).not.toBeInTheDocument();
        expect(screen.queryByText(/^from /)).not.toBeInTheDocument();
    });

    it('sends the action filter to the API', async () => {
        const user = userEvent.setup();
        const listAuditLog = vi.fn().mockResolvedValue({ entries: [entry()], total: 1 });

        renderPage({ ui: <AuditLogPage />, client: { listAuditLog } });

        await user.type(await screen.findByLabelText('Action'), 'oauth_client.revoked');

        await waitFor(() =>
            expect(listAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'oauth_client.revoked' })),
        );
    });

    it('offers more only while entries remain unfetched', async () => {
        const listAuditLog = vi.fn().mockResolvedValue({ entries: [entry()], total: 120 });

        renderPage({ ui: <AuditLogPage />, client: { listAuditLog } });

        expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
    });

    it('says so when nothing matches, instead of leaving the page blank', async () => {
        renderPage({
            ui: <AuditLogPage />,
            client: { listAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }) },
        });

        expect(await screen.findByText('No entries')).toBeInTheDocument();
    });

    it('reports a failed read inline, with a retry', async () => {
        renderPage({
            ui: <AuditLogPage />,
            client: { listAuditLog: vi.fn().mockRejectedValue(new Error('audit log is down')) },
        });

        expect(await screen.findByText('audit log is down')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
});
