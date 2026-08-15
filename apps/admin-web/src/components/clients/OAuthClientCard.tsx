import { useTranslation } from 'react-i18next';
import { Badge, Button, Chip } from '@ctm/ui';
import type { AdminOAuthClientDto } from '@ctm/api-client';
import { formatDateTime } from '../../lib/format.js';

/**
 * One registered client. A seeded client keeps its row rather than being hidden: whether
 * `ctm-cli` exists and when it was last used is information the operator needs, even though
 * the deployment owns its definition.
 */
export function OAuthClientCard({
    client,
    onEdit,
    onRevoke,
}: {
    client: AdminOAuthClientDto;
    onEdit: (client: AdminOAuthClientDto) => void;
    onRevoke: (client: AdminOAuthClientDto) => void;
}): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <li className="flex flex-col gap-3 rounded-ctm border border-line bg-panel px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-fg">{client.clientName}</strong>
                        <Badge variant={client.isDynamic ? 'neutral' : 'warn'}>
                            {client.isDynamic ? t('clients.dynamicBadge') : t('clients.seededBadge')}
                        </Badge>
                    </span>
                    <code className="truncate text-[11px] text-muted">{client.clientId}</code>
                </div>

                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => onEdit(client)}
                        disabled={!client.isDynamic}
                        aria-label={t('clients.editLabel', { name: client.clientName })}
                    >
                        {t('clients.edit')}
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => onRevoke(client)}
                        disabled={!client.isDynamic}
                        aria-label={t('clients.revokeLabel', { name: client.clientName })}
                    >
                        {t('clients.revoke')}
                    </Button>
                </div>
            </div>

            {!client.isDynamic && <p className="text-[11px] text-muted">{t('clients.seededHint')}</p>}

            <ul className="flex flex-wrap gap-1.5">
                {client.scopes.map((scope) => (
                    <li key={scope}>
                        <Chip label={scope} />
                    </li>
                ))}
            </ul>

            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted">
                <Detail label={t('clients.column.issuedAt')} value={formatDateTime({ iso: client.issuedAt, never: t('common.never') })} />
                <Detail
                    label={t('clients.column.lastUsedAt')}
                    value={formatDateTime({ iso: client.lastUsedAt, never: t('common.never') })}
                />
                <Detail label={t('clients.form.redirectUris')} value={client.redirectUris.join(', ')} />
            </dl>
        </li>
    );
}

function Detail({ label, value }: { label: string; value: string }): React.JSX.Element {
    return (
        <span className="flex gap-1.5">
            <dt className="uppercase tracking-[0.12em]">{label}</dt>
            <dd className="text-fg">{value}</dd>
        </span>
    );
}
