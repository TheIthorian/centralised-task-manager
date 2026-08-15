import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Banner, Button } from '@ctm/ui';
import type { SiteMetricsDto } from '@ctm/api-client';
import { useAdminApi } from '../api/AdminApiContext.js';
import { queryKeys } from '../api/query-keys.js';
import { BreakdownList } from '../components/BreakdownList.js';
import { PageHeader } from '../components/PageHeader.js';
import { QueryState } from '../components/QueryState.js';
import { StatCard } from '../components/StatCard.js';
import { formatCount, formatDateTime } from '../lib/format.js';

/** Aggregate counts across the deployment. Totals only; time series live in the analytics tool. */
export function DashboardPage(): React.JSX.Element {
    const { t } = useTranslation();
    const api = useAdminApi();

    const { data, isPending, error, refetch } = useQuery({
        queryKey: queryKeys.metrics,
        queryFn: () => api.getSiteMetrics(),
    });

    return (
        <>
            <PageHeader
                title={t('dashboard.title')}
                subtitle={t('dashboard.subtitle')}
                action={
                    <Button variant="secondary" onClick={() => void refetch()}>
                        {t('dashboard.refresh')}
                    </Button>
                }
            />

            <QueryState
                isPending={isPending}
                error={error}
                title={t('dashboard.loadFailed')}
                onRetry={() => void refetch()}
                rows={6}
            />

            {data && <Metrics metrics={data} />}
        </>
    );
}

function Metrics({ metrics }: { metrics: SiteMetricsDto }): React.JSX.Element {
    const { t } = useTranslation();
    const { users, tasks, connectors, sync } = metrics;

    return (
        <div className="flex flex-col gap-8">
            <Group title={t('dashboard.users.title')}>
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label={t('dashboard.users.total')} value={formatCount(users.total)} />
                    <StatCard
                        label={t('dashboard.users.createdLast7Days')}
                        value={formatCount(users.createdLast7Days)}
                    />
                    <StatCard
                        label={t('dashboard.users.createdLast30Days')}
                        value={formatCount(users.createdLast30Days)}
                    />
                </div>
            </Group>

            <Group title={t('dashboard.tasks.title')}>
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label={t('dashboard.tasks.total')} value={formatCount(tasks.total)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <BreakdownList title={t('dashboard.tasks.byStatus')} buckets={tasks.byStatus} />
                    <BreakdownList title={t('dashboard.tasks.bySource')} buckets={tasks.bySource} />
                </div>
            </Group>

            <Group title={t('dashboard.connectors.title')}>
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard label={t('dashboard.connectors.total')} value={formatCount(connectors.total)} />
                    <StatCard label={t('dashboard.connectors.enabled')} value={formatCount(connectors.enabled)} />
                    <StatCard
                        label={t('dashboard.connectors.failing')}
                        value={formatCount(connectors.failing)}
                        hint={t('dashboard.connectors.failingHint')}
                        tone={connectors.failing > 0 ? 'warn' : 'neutral'}
                    />
                </div>
                <BreakdownList title={t('dashboard.connectors.bySource')} buckets={connectors.bySource} />
            </Group>

            <Group title={t('dashboard.sync.title')}>
                {sync.succeededLast24Hours === 0 && (
                    <Banner tone="warn" title={t('dashboard.sync.title')} body={t('dashboard.sync.stalled')} />
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label={t('dashboard.sync.lastSucceededAt')}
                        value={formatDateTime({ iso: sync.lastSucceededAt, never: t('common.never') })}
                    />
                    <StatCard
                        label={t('dashboard.sync.succeededLast24Hours')}
                        value={formatCount(sync.succeededLast24Hours)}
                    />
                    <StatCard
                        label={t('dashboard.sync.failedLast24Hours')}
                        value={formatCount(sync.failedLast24Hours)}
                        tone={sync.failedLast24Hours > 0 ? 'warn' : 'neutral'}
                    />
                    <StatCard
                        label={t('dashboard.sync.inFlight')}
                        value={formatCount(sync.inFlight)}
                        hint={t('dashboard.sync.inFlightHint')}
                    />
                </div>
            </Group>

            <p className="text-[11px] text-muted">
                {t('dashboard.generatedAt', {
                    time: formatDateTime({ iso: metrics.generatedAt, never: t('common.never') }),
                })}
            </p>
        </div>
    );
}

function Group({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
            {children}
        </section>
    );
}
