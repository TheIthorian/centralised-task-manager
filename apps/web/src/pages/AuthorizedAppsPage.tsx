import { useState } from 'react';
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
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm">Loading…</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black dark:text-white">
                    Authorized Apps
                </h1>
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm mt-1">
                    Third-party apps you have granted access to your account.
                </p>
            </div>

            {isError && (
                <p className="text-nb-red font-bold text-sm mb-4">
                    {getErrorMessage(error, 'Failed to load authorized apps.')}
                </p>
            )}

            {apps.length === 0 && !isError && (
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm">No authorized apps.</p>
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
    const [confirming, setConfirming] = useState(false);

    const revokeMutation = useMutation({
        mutationFn: () => api.revokeAuthorizedApp({ clientId: app.clientId }),
        onSuccess: () => {
            onRevoked();
        },
    });

    const authorizedDate = new Date(app.authorizedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="font-black uppercase text-sm tracking-wide text-nb-black dark:text-white">
                        {app.clientName}
                    </p>
                    <p className="text-xs text-nb-black/50 dark:text-white/40 font-bold mt-0.5">
                        Authorized {authorizedDate}
                    </p>
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
                            className="px-2 py-0.5 text-xs font-bold uppercase border-2 border-nb-black dark:border-white/20 text-nb-black dark:text-white"
                        >
                            {scope}
                        </span>
                    ))}
                </div>
            )}

            {confirming && (
                <div className="flex flex-col gap-2 border-t-2 border-nb-black/20 dark:border-white/10 pt-2">
                    <p className="text-sm font-bold text-nb-black dark:text-white">
                        Revoke access for {app.clientName}? This cannot be undone.
                    </p>

                    {revokeMutation.isError && (
                        <p className="text-nb-red font-bold text-sm">
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
                            className="font-black uppercase text-xs text-nb-black dark:text-white underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
