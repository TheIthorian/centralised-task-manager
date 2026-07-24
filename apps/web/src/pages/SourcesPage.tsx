import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { ConnectorType } from '@ctm/api-client';
import type { ConnectorStatusDto, ConnectorHealthDto, TaskSyncJobDto } from '@ctm/api-client';
import { getErrorMessage } from '../api/error-message.js';
import { useAuth } from '../auth/AuthContext.js';
import { readTokens } from '../auth/auth-storage.js';
import { SourceCard } from '../components/sources/SourceCard.js';
import { NotionSetupModal } from '../components/sources/NotionSetupModal.js';
import config from '../config.js';

/** Settings sub-page: connected task sources. */
export function SourcesPage(): React.JSX.Element {
    const qc = useQueryClient();
    const { api } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [syncJobs, setSyncJobs] = useState<Map<string, TaskSyncJobDto>>(new Map());
    const socketRef = useRef<Socket | null>(null);

    const {
        data: connectors = [],
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['connectors'],
        queryFn: () => api.listConnectors(),
    });

    const { data: healthResults = [], isLoading: isHealthLoading } = useQuery({
        queryKey: ['connectors', 'health'],
        queryFn: () => api.getConnectorHealth(),
        enabled: connectors.some((c) => c.accounts.length > 0),
    });

    const healthByConnection = new Map<string, ConnectorHealthDto>(
        healthResults.map((h: ConnectorHealthDto) => [h.connectionId, h]),
    );

    // WebSocket connection — opens once, cleans up on unmount
    useEffect(() => {
        const baseUrl = config.apiUrl;
        const { accessToken } = readTokens();

        const socket = io(baseUrl, {
            auth: { token: accessToken },
            transports: ['websocket'],
        });

        socket.on('sync:progress', (job: TaskSyncJobDto) => {
            setSyncJobs((prev) => new Map(prev).set(job.connectionId, job));

            if (job.status === 'done') {
                void qc.invalidateQueries({ queryKey: ['tasks'] });
                void qc.invalidateQueries({ queryKey: ['connectors'] });
            }
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, []);

    const connectMutation = useMutation({
        mutationFn: async (source: string) => {
            const url = await api.getConnectorAuthUrl({ source });
            window.location.href = url;
        },
    });

    const disconnectMutation = useMutation({
        mutationFn: (connectionId: string) => api.disconnectConnector({ connectionId }),
        onSuccess: (_data, connectionId) => {
            qc.setQueryData<ConnectorStatusDto[]>(['connectors'], (prev = []) =>
                prev.map((c) => ({ ...c, accounts: c.accounts.filter((a) => a.connectionId !== connectionId) })),
            );
        },
    });

    const syncMutation = useMutation({
        mutationFn: (connectionId: string) => api.syncConnector({ connectionId }),
        onSuccess: (job) => {
            setSyncJobs((prev) => new Map(prev).set(job.connectionId, job));
        },
    });

    const cancelSyncMutation = useMutation({
        mutationFn: ({ connectionId, jobId }: { connectionId: string; jobId: string }) =>
            api.cancelSyncJob({ connectionId, jobId }),
        onError: (err) => {
            setBanner({ type: 'error', message: getErrorMessage(err, 'Failed to cancel sync.') });
        },
    });

    const testChannelMutation = useMutation({
        mutationFn: (source: string) => api.testNotificationChannel({ channel: source }),
        onSuccess: (_data, source) => {
            setBanner({ type: 'success', message: `Test notification sent via ${source}.` });
        },
        onError: (err) => {
            setBanner({ type: 'error', message: getErrorMessage(err, 'Failed to send test notification.') });
        },
    });

    const [setupConnectionId, setSetupConnectionId] = useState<string | null>(null);
    const [pendingSetupSource, setPendingSetupSource] = useState<string | null>(null);

    // Post-OAuth redirect only names the source; resolve the connection needing setup once connectors load.
    useEffect(() => {
        if (!pendingSetupSource) return;

        const connector = connectors.find((c) => c.source === pendingSetupSource);
        const account = connector?.accounts.find((a) => a.setupRequired);

        if (account) {
            setSetupConnectionId(account.connectionId);
            setPendingSetupSource(null);
        }
    }, [pendingSetupSource, connectors]);

    useEffect(() => {
        const connected = searchParams.get('connected');
        const setup = searchParams.get('setup');
        const errorParam = searchParams.get('error');

        if (connected && setup === 'required') {
            setPendingSetupSource(connected);
            setSearchParams({}, { replace: true });
        } else if (connected) {
            setBanner({ type: 'success', message: `${connected} connected successfully.` });
            setSearchParams({}, { replace: true });
        } else if (errorParam) {
            setBanner({ type: 'error', message: errorParam });
            setSearchParams({}, { replace: true });
        }
    }, []);

    const isPending =
        connectMutation.isPending ||
        disconnectMutation.isPending ||
        syncMutation.isPending ||
        cancelSyncMutation.isPending ||
        testChannelMutation.isPending;

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black dark:text-white">
                    Connected Sources
                </h1>
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm mt-1">
                    Connect external task managers to sync your tasks here.
                </p>
            </div>

            {banner && (
                <div
                    className={`mb-4 border-2 p-3 flex items-center justify-between ${banner.type === 'success' ? 'border-green-600 bg-green-50 dark:bg-green-900/20' : 'border-nb-red bg-nb-red/10'}`}
                >
                    <p
                        className={`font-bold text-sm ${banner.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-nb-red'}`}
                    >
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

            {isLoading && (
                <p className="font-bold text-nb-black/60 dark:text-white/50 uppercase text-sm tracking-wide">
                    Loading…
                </p>
            )}

            {isError && (
                <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                    <p className="text-nb-red font-bold text-sm">
                        {getErrorMessage(error, 'Failed to load sources. Is the API running?')}
                    </p>
                </div>
            )}

            {!isLoading &&
                !isError &&
                connectors.filter((c) => c.connectorType === ConnectorType.TaskSync).length === 0 && (
                    <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                        <p className="font-black uppercase text-nb-black text-lg">No Sources Available.</p>
                        <p className="font-bold text-nb-black/60 text-sm mt-1">
                            No integrations are configured on this server.
                        </p>
                    </div>
                )}

            {!isLoading &&
                !isError &&
                connectors.filter((c) => c.connectorType === ConnectorType.TaskSync).length > 0 && (
                    <div className="flex flex-col gap-3">
                        {connectors
                            .filter((c) => c.connectorType === ConnectorType.TaskSync)
                            .map((connector) => (
                                <SourceCard
                                    key={connector.source}
                                    connector={connector}
                                    onConnect={(source) => connectMutation.mutate(source)}
                                    onDisconnect={(connectionId) => disconnectMutation.mutate(connectionId)}
                                    onSync={(connectionId) => syncMutation.mutate(connectionId)}
                                    onCancelSync={(connectionId, jobId) =>
                                        cancelSyncMutation.mutate({ connectionId, jobId })
                                    }
                                    onConfigure={(connectionId) => setSetupConnectionId(connectionId)}
                                    syncJobs={syncJobs}
                                    isPending={isPending}
                                    healthByConnection={healthByConnection}
                                    isHealthLoading={isHealthLoading}
                                />
                            ))}
                    </div>
                )}

            <div className="mt-8 mb-6">
                <h2 className="text-lg font-black uppercase tracking-tight text-nb-black dark:text-white">
                    Notification Connectors
                </h2>
                <p className="text-nb-black/60 dark:text-white/50 font-bold text-sm mt-1">
                    Connect notification channels to receive alerts outside the app.
                </p>
            </div>

            <div className="flex flex-col gap-3">
                {connectors
                    .filter((c) => c.connectorType === ConnectorType.Notification)
                    .map((connector) => (
                        <SourceCard
                            key={connector.source}
                            connector={connector}
                            onConnect={(source) => connectMutation.mutate(source)}
                            onDisconnect={(connectionId) => disconnectMutation.mutate(connectionId)}
                            onSync={(connectionId) => syncMutation.mutate(connectionId)}
                            onCancelSync={(connectionId, jobId) =>
                                cancelSyncMutation.mutate({ connectionId, jobId })
                            }
                            onTest={(source) => testChannelMutation.mutate(source)}
                            syncJobs={syncJobs}
                            isPending={isPending}
                        />
                    ))}
            </div>

            {setupConnectionId && (
                <NotionSetupModal
                    connectionId={setupConnectionId}
                    onComplete={() => {
                        setBanner({ type: 'success', message: 'Account connected successfully.' });
                        setSetupConnectionId(null);
                        void qc.invalidateQueries({ queryKey: ['connectors'] });
                    }}
                    onClose={() => {
                        setBanner({ type: 'error', message: 'Setup cancelled. Notion was not fully configured.' });
                        setSetupConnectionId(null);
                    }}
                />
            )}
        </div>
    );
}
