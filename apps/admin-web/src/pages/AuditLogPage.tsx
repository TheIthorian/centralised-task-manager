import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, Input } from '@ctm/ui';
import type { AuditLogEntryDto, ListAuditLogQueryDto } from '@ctm/api-client';
import { useAdminApi } from '../api/AdminApiContext.js';
import { queryKeys } from '../api/query-keys.js';
import { PageHeader } from '../components/PageHeader.js';
import { QueryState } from '../components/QueryState.js';
import { formatDateTime } from '../lib/format.js';

const PAGE_SIZE = 50;

/** The append-only record of what an operator changed. */
export function AuditLogPage(): React.JSX.Element {
    const { t } = useTranslation();
    const api = useAdminApi();

    const [action, setAction] = useState('');
    const [targetId, setTargetId] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);

    const query = toQuery({
        action: useDeferredValue(action),
        targetId: useDeferredValue(targetId),
        limit,
    });

    const { data, isPending, error, refetch } = useQuery({
        queryKey: queryKeys.auditLog(query),
        queryFn: () => api.listAuditLog(query),
    });

    const hasFilters = action.length > 0 || targetId.length > 0;
    const hasMore = data !== undefined && data.entries.length < data.total;

    return (
        <>
            <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-56 flex-1">
                    <Input
                        label={t('audit.filterAction')}
                        type="search"
                        value={action}
                        placeholder={t('audit.filterActionPlaceholder')}
                        onChange={(event) => setAction(event.target.value)}
                        maxLength={200}
                    />
                </div>
                <div className="min-w-56 flex-1">
                    <Input
                        label={t('audit.filterTarget')}
                        type="search"
                        value={targetId}
                        placeholder={t('audit.filterTargetPlaceholder')}
                        onChange={(event) => setTargetId(event.target.value)}
                        maxLength={200}
                    />
                </div>
                {hasFilters && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setAction('');
                            setTargetId('');
                        }}
                    >
                        {t('audit.clearFilters')}
                    </Button>
                )}
            </div>

            <QueryState
                isPending={isPending}
                error={error}
                title={t('audit.loadFailed')}
                onRetry={() => void refetch()}
            />

            {data && data.entries.length === 0 && (
                <EmptyState title={t('audit.empty.title')} body={t('audit.empty.body')} />
            )}

            {data && data.entries.length > 0 && (
                <>
                    <p aria-live="polite" className="text-[11px] text-muted">
                        {t('audit.count', { count: data.total })}
                    </p>
                    <ol className="flex flex-col gap-2">
                        {data.entries.map((entry) => (
                            <AuditEntry key={entry.id} entry={entry} />
                        ))}
                    </ol>
                    {hasMore && (
                        <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                            {t('common.loadMore')}
                        </Button>
                    )}
                </>
            )}
        </>
    );
}

function AuditEntry({ entry }: { entry: AuditLogEntryDto }): React.JSX.Element {
    const { t } = useTranslation();
    const metadata = Object.entries(entry.metadata);

    return (
        <li className="flex flex-col gap-1.5 rounded-ctm border border-line bg-panel px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="text-[13px] text-fg">{entry.action}</code>
                <span className="text-[11px] text-muted">{t('audit.actor', { actor: entry.actor })}</span>
                {/* The label is denormalised on write, so it still reads correctly after the
                    thing it describes has been deleted. */}
                {entry.targetLabel !== null && (
                    <span className="text-[11px] text-muted">{t('audit.target', { label: entry.targetLabel })}</span>
                )}
                {entry.ip !== null && (
                    <span className="text-[11px] text-muted">{t('audit.fromIp', { ip: entry.ip })}</span>
                )}
                <time
                    dateTime={entry.createdAt}
                    className="ml-auto text-[11px] tabular-nums text-muted"
                >
                    {formatDateTime({ iso: entry.createdAt, never: t('common.never') })}
                </time>
            </div>

            {metadata.length > 0 && (
                <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
                    {metadata.map(([key, value]) => (
                        <span key={key} className="flex gap-1.5">
                            <dt>{key}</dt>
                            <dd className="text-fg">{JSON.stringify(value)}</dd>
                        </span>
                    ))}
                </dl>
            )}
        </li>
    );
}

function toQuery({
    action,
    targetId,
    limit,
}: {
    action: string;
    targetId: string;
    limit: number;
}): ListAuditLogQueryDto {
    return {
        limit,
        ...(action.trim().length > 0 ? { action: action.trim() } : {}),
        ...(targetId.trim().length > 0 ? { targetId: targetId.trim() } : {}),
    };
}
