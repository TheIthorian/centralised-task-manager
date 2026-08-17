import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.js';
import { getErrorMessage } from '../api/error-message.js';
import { Button } from '@ctm/ui';
import type { AuthorizedAppDto } from '@ctm/api-client';

/** Settings sub-page: list and revoke authorized OAuth apps. */
export function AuthorizedAppsPage(): React.JSX.Element {
    const { api } = useAuth();
    const queryClient = useQueryClient();

    const {
        data: apps = [],
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['authorized-apps'],
        queryFn: () => api.getAuthorizedApps(),
    });

    if (isLoading) {
        return (
            <div className="p-4 md:p-6 max-w-2xl">
                <p className="text-muted font-medium text-sm">Loading…</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">
                    Authorized Apps
                </h1>
                <p className="text-muted font-medium text-sm mt-1">
                    Third-party apps you have granted access to your account.
                </p>
            </div>

            {isError && (
                <p className="text-warn font-medium text-sm mb-4">
                    {getErrorMessage(error, 'Failed to load authorized apps.')}
                </p>
            )}

            {apps.length === 0 && !isError && (
                <p className="text-muted font-medium text-sm">No authorized apps.</p>
            )}

            <div className="flex flex-col gap-3">
                {apps.map((app) => (
                    <AppRow
                        key={app.clientId}
                        app={app}
                        onRevoked={() => queryClient.invalidateQueries({ queryKey: ['authorized-apps'] })}
                        api={api}
                    />
                ))}
            </div>
        </div>
    );
}

type AppRowProps = {
    app: AuthorizedAppDto;
    onRevoked: () => void;
    api: ReturnType<typeof useAuth>['api'];
};

function AppRow({ app, onRevoked, api }: AppRowProps): React.JSX.Element {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);

    const revokeMutation = useMutation({
        mutationFn: () => api.revokeAuthorizedApp({ clientId: app.clientId }),
        onSuccess: () => {
            onRevoked();
        },
    });

    const declared = declaredEntries({
        app,
        labels: {
            website: t('authorizedApps.declared.website'),
            terms: t('authorizedApps.declared.terms'),
            privacy: t('authorizedApps.declared.privacy'),
            contact: t('authorizedApps.declared.contact'),
            softwareId: t('authorizedApps.declared.softwareId'),
        },
    });

    // A path on the API origin, not the URL the app declared: the server fetched and re-encoded it.
    const logoUrl = app.logoPath ? `${api.getBaseUrl()}${app.logoPath}` : null;

    const authorizedDate = new Date(app.authorizedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="bg-panel border border-line p-4 flex flex-col gap-2 rounded-ctm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={t('authorizedApps.logoAlt', { name: app.clientName })}
                            width={32}
                            height={32}
                            className="w-8 h-8 shrink-0 border border-line rounded-ctm"
                        />
                    )}

                    <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm tracking-wide text-fg">
                            {app.clientName}
                        </p>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]st border border-line/30 text-muted rounded-ctm">
                            OAuth
                        </span>
                    </div>
                        <p className="text-xs text-muted font-medium">Authorized {authorizedDate}</p>
                    </div>
                </div>

                {!confirming && (
                    <Button variant="danger" onClick={() => setConfirming(true)} disabled={revokeMutation.isPending}>
                        Revoke
                    </Button>
                )}
            </div>

            {app.scopes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {app.scopes.map((scope) => (
                        <span
                            key={scope}
                            className="px-2 py-0.5 text-xs font-medium uppercase border border-line text-fg rounded-ctm"
                        >
                            {scope}
                        </span>
                    ))}
                </div>
            )}

            {declared.length > 0 && (
                <div className="border-t border-line/20 pt-2">
                    <p className="text-xs text-muted font-medium mb-1">{t('authorizedApps.declared.label')}</p>

                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {declared.map((entry) => (
                            <div key={entry.label} className="contents">
                                <dt className="text-muted font-medium">{entry.label}</dt>
                                {/* Plain text, never a link: these values are supplied by the app itself. */}
                                <dd className="text-fg font-medium break-all">{entry.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {confirming && (
                <div className="flex flex-col gap-2 border-t border-line/20 pt-2">
                    <p className="text-sm font-medium text-fg">
                        Revoke access for {app.clientName}?
                    </p>

                    {revokeMutation.isError && (
                        <p className="text-warn font-medium text-sm">
                            {getErrorMessage(revokeMutation.error, 'Failed to revoke. Please try again.')}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="danger"
                            onClick={() => revokeMutation.mutate()}
                            disabled={revokeMutation.isPending}
                        >
                            {revokeMutation.isPending ? 'Revoking…' : 'Confirm Revoke'}
                        </Button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="font-semibold text-xs text-fg underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

type DeclaredLabels = {
    website: string;
    terms: string;
    privacy: string;
    contact: string;
    softwareId: string;
};

type DeclaredEntry = { label: string; value: string };

/** Flattens the app's self-declared RFC 7591 metadata into label/value pairs to render as text. */
function declaredEntries({ app, labels }: { app: AuthorizedAppDto; labels: DeclaredLabels }): DeclaredEntry[] {
    const entries: DeclaredEntry[] = [];

    if (app.clientUri) entries.push({ label: labels.website, value: app.clientUri });
    if (app.tosUri) entries.push({ label: labels.terms, value: app.tosUri });
    if (app.policyUri) entries.push({ label: labels.privacy, value: app.policyUri });
    if (app.contacts && app.contacts.length > 0) entries.push({ label: labels.contact, value: app.contacts.join(', ') });
    if (app.softwareId) entries.push({ label: labels.softwareId, value: app.softwareId });

    return entries;
}
