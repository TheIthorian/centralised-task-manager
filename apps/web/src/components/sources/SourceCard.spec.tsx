import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectorType } from '@ctm/api-client';
import type { ConnectorStatusDto, TaskSyncJobDto, ConnectorHealthDto } from '@ctm/api-client';
import { SourceCard } from './SourceCard.js';

const account = (id: string, email: string): ConnectorStatusDto['accounts'][number] => ({
    connectionId: id,
    externalAccountId: `ext-${id}`,
    email,
    label: null,
    setupRequired: false,
});

const base: ConnectorStatusDto = {
    source: 'todoist',
    connectorType: ConnectorType.TaskSync,
    connectionSchema: {},
    accounts: [],
};

const noopProps = {
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSync: vi.fn(),
    onCancelSync: vi.fn(),
    isPending: false,
    syncJobs: new Map<string, TaskSyncJobDto>(),
    healthByConnection: new Map<string, ConnectorHealthDto>(),
};

describe('SourceCard', () => {
    it('renders the source name', () => {
        render(<SourceCard connector={base} {...noopProps} />);
        expect(screen.getByText('Todoist')).toBeInTheDocument();
    });

    it('shows Connect button when no accounts', () => {
        render(<SourceCard connector={base} {...noopProps} />);
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    it('lists each connected account and an add-account button', () => {
        const connector = { ...base, accounts: [account('1', 'a@x.com'), account('2', 'b@x.com')] };

        render(<SourceCard connector={connector} {...noopProps} />);

        expect(screen.getByText('a@x.com')).toBeInTheDocument();
        expect(screen.getByText('b@x.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add account/i })).toBeInTheDocument();
    });

    it('calls onConnect with the source when Connect is clicked', async () => {
        const onConnect = vi.fn();

        render(<SourceCard connector={base} {...noopProps} onConnect={onConnect} />);
        await userEvent.click(screen.getByRole('button', { name: /connect/i }));
        expect(onConnect).toHaveBeenCalledWith('todoist');
    });

    it('calls onDisconnect with the connectionId when Disconnect is clicked', async () => {
        const onDisconnect = vi.fn();
        const connector = { ...base, accounts: [account('c1', 'a@x.com')] };

        render(<SourceCard connector={connector} {...noopProps} onDisconnect={onDisconnect} />);
        await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
        expect(onDisconnect).toHaveBeenCalledWith('c1');
    });

    it('calls onSync with the connectionId when Sync is clicked', async () => {
        const onSync = vi.fn();
        const connector = { ...base, accounts: [account('c1', 'a@x.com')] };

        render(<SourceCard connector={connector} {...noopProps} onSync={onSync} />);
        await userEvent.click(screen.getByRole('button', { name: /^sync$/i }));
        expect(onSync).toHaveBeenCalledWith('c1');
    });
});
