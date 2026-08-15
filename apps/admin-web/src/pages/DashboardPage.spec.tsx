import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SiteMetricsDto } from '@ctm/api-client';
import { DashboardPage } from './DashboardPage.js';
import { renderPage } from '../test-utils.js';

function metrics(overrides: Partial<SiteMetricsDto> = {}): SiteMetricsDto {
    return {
        users: { total: 1234, createdLast7Days: 12, createdLast30Days: 40 },
        tasks: { total: 900, byStatus: [{ key: 'open', count: 700 }], bySource: [{ key: 'todoist', count: 900 }] },
        connectors: { total: 10, enabled: 9, failing: 0, bySource: [{ key: 'todoist', count: 10 }] },
        sync: { lastSucceededAt: '2026-08-15T10:00:00.000Z', succeededLast24Hours: 96, failedLast24Hours: 0, inFlight: 0 },
        generatedAt: '2026-08-15T12:00:00.000Z',
        ...overrides,
    };
}

describe('DashboardPage', () => {
    it('shows the account totals returned by the API', async () => {
        renderPage({ ui: <DashboardPage />, client: { getSiteMetrics: vi.fn().mockResolvedValue(metrics()) } });

        expect(await screen.findByText('1,234')).toBeInTheDocument();
        expect(screen.getByText('New in 7 days')).toBeInTheDocument();
    });

    it('breaks tasks down by status and by source', async () => {
        renderPage({ ui: <DashboardPage />, client: { getSiteMetrics: vi.fn().mockResolvedValue(metrics()) } });

        expect(await screen.findByText('open')).toBeInTheDocument();
        expect(screen.getAllByText('todoist')).toHaveLength(2);
    });

    it('warns when no sync job has succeeded in the trailing day', async () => {
        const stalled = metrics({
            sync: { lastSucceededAt: null, succeededLast24Hours: 0, failedLast24Hours: 3, inFlight: 7 },
        });

        renderPage({ ui: <DashboardPage />, client: { getSiteMetrics: vi.fn().mockResolvedValue(stalled) } });

        expect(await screen.findByText('No sync job has completed in the last 24 hours.')).toBeInTheDocument();
        expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('reports a failed read inline, with a retry, rather than rendering nothing', async () => {
        const getSiteMetrics = vi.fn().mockRejectedValue(new Error('metrics endpoint is down'));

        renderPage({ ui: <DashboardPage />, client: { getSiteMetrics } });

        expect(await screen.findByText('metrics endpoint is down')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('refetches when the operator asks for fresh figures', async () => {
        const getSiteMetrics = vi.fn().mockResolvedValue(metrics());

        renderPage({ ui: <DashboardPage />, client: { getSiteMetrics } });

        (await screen.findByRole('button', { name: 'Refresh' })).click();

        await waitFor(() => expect(getSiteMetrics).toHaveBeenCalledTimes(2));
    });
});
