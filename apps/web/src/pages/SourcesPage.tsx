import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConnectorStatusDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { SourceCard } from '../components/sources/SourceCard.js';

/** Settings sub-page: connected task sources. */
export function SourcesPage(): React.JSX.Element {
    const qc = useQueryClient();
    const { api } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const {
        data: connectors = [],
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['connectors'],
        queryFn: () => api.listConnectors(),
    });

    const connectMutation = useMutation({
        mutationFn: async (source: string) => {
            const url = await api.getConnectorAuthUrl({ source });
            window.location.href = url;
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: (source: string) => api.disconnectConnector({ source }),
        onSuccess: (_data, source) => {
            qc.setQueryData<ConnectorStatusDto[]>(['connectors'], (prev = []) =>
                prev.map((c) => (c.source === source ? { ...c, connected: false, lastSynced: undefined } : c)),
            );
        },
    });

    useEffect(() => {
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');

        if (connected) {
            setBanner({ type: 'success', message: `${connected} connected successfully.` });
            setSearchParams({}, { replace: true });
        } else if (error) {
            setBanner({ type: 'error', message: error });
            setSearchParams({}, { replace: true });
        }
    }, []);

    const isPending = connectMutation.isPending || disconnectMutation.isPending;

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black dark:text-white">Connected Sources</h1>
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm mt-1">
                    Connect external task managers to sync your tasks here.
                </p>
            </div>

            {banner && (
                <div
                    className={`mb-4 border-2 p-3 flex items-center justify-between ${banner.type === 'success' ? 'border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-nb-red bg-nb-red/10'}`}
                >
                    <p className={`font-bold text-sm ${banner.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-nb-red'}`}>
                        {banner.message}
                    </p>
                    <button
                        onClick={() => setBanner(null)}
                        className="ml-4 text-xs font-bold opacity-60 hover:opacity-100"
                    >
                        ✕
                    </button>
                </div>
            )}

            {isLoading && <p className="font-bold text-nb-black/60 dark:text-white/50 uppercase text-sm tracking-wide">Loading…</p>}

            {isError && (
                <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                    <p className="text-nb-red font-bold text-sm">
                        {getErrorMessage(error, 'Failed to load sources. Is the API running?')}
                    </p>
                </div>
            )}

            {!isLoading && !isError && connectors.length === 0 && (
                <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                    <p className="font-black uppercase text-nb-black text-lg">No Sources Available.</p>
                    <p className="font-bold text-nb-black/60 text-sm mt-1">
                        No integrations are configured on this server.
                    </p>
                </div>
            )}

            {!isLoading && !isError && connectors.length > 0 && (
                <div className="flex flex-col gap-3">
                    {connectors.map((connector) => (
                        <SourceCard
                            key={connector.source}
                            connector={connector}
                            onConnect={(source) => connectMutation.mutate(source)}
                            onDisconnect={(source) => disconnectMutation.mutate(source)}
                            isPending={isPending}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
