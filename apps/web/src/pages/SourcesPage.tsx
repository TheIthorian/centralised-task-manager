import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listConnectors, getConnectorAuthUrl, disconnectConnector } from '@ctm/api-client';
import type { ConnectorStatusDto } from '@ctm/api-client';
import { SourceCard } from '../components/sources/SourceCard.js';

/** Settings sub-page: connected task sources. */
export function SourcesPage(): React.JSX.Element {
    const qc = useQueryClient();

    const { data: connectors = [], isLoading, isError } = useQuery({
        queryKey: ['connectors'],
        queryFn: listConnectors,
    });

    const connectMutation = useMutation({
        mutationFn: async (source: string) => {
            const url = await getConnectorAuthUrl(source);
            window.location.href = url;
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: (source: string) => disconnectConnector(source),
        onSuccess: (_data, source) => {
            qc.setQueryData<ConnectorStatusDto[]>(['connectors'], (prev = []) =>
                prev.map((c) => (c.source === source ? { ...c, connected: false, lastSynced: undefined } : c)),
            );
        },
    });

    const isPending = connectMutation.isPending || disconnectMutation.isPending;

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black">Connected Sources</h1>
                <p className="text-nb-black/60 font-bold text-sm mt-1">
                    Connect external task managers to sync your tasks here.
                </p>
            </div>

            {isLoading && (
                <p className="font-bold text-nb-black/60 uppercase text-sm tracking-wide">Loading…</p>
            )}

            {isError && (
                <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                    <p className="text-nb-red font-bold text-sm">Failed to load sources. Is the API running?</p>
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
