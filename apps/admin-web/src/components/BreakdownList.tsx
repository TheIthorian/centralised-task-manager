import { useTranslation } from 'react-i18next';
import { EmptyState } from '@ctm/ui';
import type { MetricBucketDto } from '@ctm/api-client';
import { formatCount } from '../lib/format.js';

/** A count broken down by key, as a definition list rather than a chart. */
export function BreakdownList({ title, buckets }: { title: string; buckets: MetricBucketDto[] }): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-muted">{title}</h3>
            {buckets.length === 0 ? (
                <EmptyState title={t('dashboard.emptyBreakdown.title')} body={t('dashboard.emptyBreakdown.body')} />
            ) : (
                <dl className="flex flex-col rounded-ctm border border-line bg-panel">
                    {buckets.map((bucket) => (
                        <div
                            key={bucket.key}
                            className="flex items-center justify-between border-b border-hair px-3.5 py-2 last:border-b-0"
                        >
                            <dt className="text-[13px] text-fg">{bucket.key}</dt>
                            <dd className="text-[13px] tabular-nums text-muted">{formatCount(bucket.count)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
}
