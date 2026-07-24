import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceCard } from './SourceCard.js';

const base = { source: 'todoist', connected: false, lastSynced: undefined };

describe('SourceCard', () => {
    it('renders the source name', () => {
        render(<SourceCard connector={base} onConnect={vi.fn()} onDisconnect={vi.fn()} isPending={false} />);
        expect(screen.getByText('Todoist')).toBeInTheDocument();
    });

    it('shows Connect button when not connected', () => {
        render(<SourceCard connector={base} onConnect={vi.fn()} onDisconnect={vi.fn()} isPending={false} />);
        expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    it('shows Disconnect button when connected', () => {
        render(
            <SourceCard
                connector={{ source: 'todoist', connected: true, lastSynced: '2024-01-01T00:00:00.000Z' }}
                onConnect={vi.fn()}
                onDisconnect={vi.fn()}
                isPending={false}
            />,
        );
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });

    it('calls onConnect when Connect is clicked', async () => {
        const onConnect = vi.fn();
        render(<SourceCard connector={base} onConnect={onConnect} onDisconnect={vi.fn()} isPending={false} />);
        await userEvent.click(screen.getByRole('button', { name: /connect/i }));
        expect(onConnect).toHaveBeenCalledWith('todoist');
    });

    it('calls onDisconnect when Disconnect is clicked', async () => {
        const onDisconnect = vi.fn();
        render(
            <SourceCard
                connector={{ source: 'todoist', connected: true }}
                onConnect={vi.fn()}
                onDisconnect={onDisconnect}
                isPending={false}
            />,
        );
        await userEvent.click(screen.getByRole('button', { name: /disconnect/i }));
        expect(onDisconnect).toHaveBeenCalledWith('todoist');
    });
});
