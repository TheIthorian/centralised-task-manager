import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, Button, EmptyState, Input, Modal, SegmentedControl } from '@ctm/ui';
import type {
    AdminOAuthClientDto,
    CreateOAuthClientDto,
    ListOAuthClientsQueryDto,
    UpdateOAuthClientDto,
} from '@ctm/api-client';
import { useAdminApi } from '../api/AdminApiContext.js';
import { getErrorMessage } from '../api/error-message.js';
import { AUDIT_LOG_KEY_PREFIX, OAUTH_CLIENTS_KEY_PREFIX, queryKeys } from '../api/query-keys.js';
import { OAuthClientCard } from '../components/clients/OAuthClientCard.js';
import { OAuthClientForm, type OAuthClientFormValues } from '../components/clients/OAuthClientForm.js';
import { PageHeader } from '../components/PageHeader.js';
import { QueryState } from '../components/QueryState.js';
import { useToast } from '../toast/ToastContext.js';

type Ownership = 'all' | 'dynamic' | 'seeded';

/** Nothing is edited in place, so the page is in exactly one of these at a time. */
type Editing = { mode: 'create' } | { mode: 'edit'; client: AdminOAuthClientDto } | null;

const PAGE_SIZE = 25;

/** Register, reconfigure and revoke the applications that may ask a user to authorise them. */
export function OAuthClientsPage(): React.JSX.Element {
    const { t } = useTranslation();
    const api = useAdminApi();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const [search, setSearch] = useState('');
    const [ownership, setOwnership] = useState<Ownership>('all');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [editing, setEditing] = useState<Editing>(null);
    const [revoking, setRevoking] = useState<AdminOAuthClientDto | null>(null);

    // Typing should not fire a request per keystroke; the deferred value settles first.
    const query = toQuery({ search: useDeferredValue(search), ownership, limit });

    const clients = useQuery({
        queryKey: queryKeys.oauthClients(query),
        queryFn: () => api.listOAuthClients(query),
    });

    const scopes = useQuery({
        queryKey: queryKeys.availableScopes,
        queryFn: () => api.listAvailableScopes(),
    });

    const invalidate = async (): Promise<void> => {
        await queryClient.invalidateQueries({ queryKey: OAUTH_CLIENTS_KEY_PREFIX });
        await queryClient.invalidateQueries({ queryKey: AUDIT_LOG_KEY_PREFIX });
    };

    const save = useMutation({
        mutationFn: (values: OAuthClientFormValues) =>
            editing?.mode === 'edit'
                ? api.updateOAuthClient({ clientId: editing.client.clientId, dto: toUpdateDto(values) })
                : api.createOAuthClient({ dto: toCreateDto(values) }),
        onSuccess: async (client) => {
            const key = editing?.mode === 'edit' ? 'clients.toast.updated' : 'clients.toast.created';

            setEditing(null);
            await invalidate();
            showToast(t(key, { name: client.clientName }));
        },
    });

    const revoke = useMutation({
        mutationFn: (client: AdminOAuthClientDto) => api.revokeOAuthClient({ clientId: client.clientId }),
        onSuccess: async (client) => {
            setRevoking(null);
            await invalidate();
            showToast(t('clients.toast.revoked', { name: client.clientName }));
        },
    });

    const page = clients.data;
    const hasMore = page !== undefined && page.clients.length < page.total;

    return (
        <>
            <PageHeader
                title={t('clients.title')}
                subtitle={t('clients.subtitle')}
                action={<Button onClick={() => setEditing({ mode: 'create' })}>{t('clients.register')}</Button>}
            />

            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-56 flex-1">
                    <Input
                        label={t('clients.search')}
                        type="search"
                        value={search}
                        placeholder={t('clients.searchPlaceholder')}
                        onChange={(event) => setSearch(event.target.value)}
                        maxLength={200}
                    />
                </div>
                <SegmentedControl<Ownership>
                    label={t('clients.filterLabel')}
                    value={ownership}
                    onChange={setOwnership}
                    options={[
                        { value: 'all', label: t('clients.filter.all') },
                        { value: 'dynamic', label: t('clients.filter.dynamic') },
                        { value: 'seeded', label: t('clients.filter.seeded') },
                    ]}
                />
            </div>

            <QueryState
                isPending={clients.isPending}
                error={clients.error}
                title={t('clients.loadFailed')}
                onRetry={() => void clients.refetch()}
            />

            {revoke.error && (
                <Banner
                    tone="warn"
                    title={t('clients.revokeDialog.failed')}
                    body={getErrorMessage(revoke.error, t('common.unknownError'))}
                />
            )}

            {page && page.clients.length === 0 && (
                <EmptyState title={t('clients.empty.title')} body={t('clients.empty.body')} />
            )}

            {page && page.clients.length > 0 && (
                <>
                    <p aria-live="polite" className="text-[11px] text-muted">
                        {t('clients.count', { count: page.total })}
                    </p>
                    <ul className="flex flex-col gap-3">
                        {page.clients.map((client) => (
                            <OAuthClientCard
                                key={client.clientId}
                                client={client}
                                onEdit={(target) => setEditing({ mode: 'edit', client: target })}
                                onRevoke={setRevoking}
                            />
                        ))}
                    </ul>
                    {hasMore && (
                        <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                            {t('common.loadMore')}
                        </Button>
                    )}
                </>
            )}

            <Modal
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing?.mode === 'edit' ? t('clients.form.editTitle') : t('clients.form.createTitle')}
                widthClassName="md:max-w-xl"
            >
                <OAuthClientForm
                    // Remounting per target clears the previous client's values; without it the
                    // form keeps whichever client opened it first.
                    key={editing?.mode === 'edit' ? editing.client.clientId : 'create'}
                    client={editing?.mode === 'edit' ? editing.client : null}
                    availableScopes={scopes.data ?? []}
                    submitLabel={
                        editing?.mode === 'edit' ? t('clients.form.submitEdit') : t('clients.form.submitCreate')
                    }
                    isPending={save.isPending}
                    submitError={save.error ? getErrorMessage(save.error, t('common.unknownError')) : null}
                    onSubmit={(values) => save.mutate(values)}
                    onCancel={() => setEditing(null)}
                />
            </Modal>

            <Modal open={revoking !== null} onClose={() => setRevoking(null)} title={t('clients.revokeDialog.title')}>
                <div className="flex flex-col gap-4">
                    <p className="text-[13px] text-fg">
                        {t('clients.revokeDialog.body', { name: revoking?.clientName ?? '' })}
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setRevoking(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="danger"
                            disabled={revoke.isPending}
                            aria-disabled={revoke.isPending}
                            onClick={() => revoking && revoke.mutate(revoking)}
                        >
                            {t('clients.revokeDialog.confirm')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

function toQuery({
    search,
    ownership,
    limit,
}: {
    search: string;
    ownership: Ownership;
    limit: number;
}): ListOAuthClientsQueryDto {
    return {
        limit,
        ...(search.trim().length > 0 ? { search: search.trim() } : {}),
        ...(ownership === 'all' ? {} : { isDynamic: ownership === 'dynamic' }),
    };
}

function toCreateDto(values: OAuthClientFormValues): CreateOAuthClientDto {
    return {
        clientName: values.clientName,
        redirectUris: values.redirectUris,
        scopes: values.scopes,
        contacts: values.contacts,
        // Absent rather than empty: the create schema rejects a blank URL, and never having
        // supplied a homepage is not the same as clearing one.
        ...(values.clientUri.length > 0 ? { clientUri: values.clientUri } : {}),
    };
}

/** An emptied display field is sent as an explicit null, which is how the API clears it. */
function toUpdateDto(values: OAuthClientFormValues): UpdateOAuthClientDto {
    return {
        clientName: values.clientName,
        redirectUris: values.redirectUris,
        scopes: values.scopes,
        contacts: values.contacts,
        clientUri: values.clientUri.length > 0 ? values.clientUri : null,
    };
}
