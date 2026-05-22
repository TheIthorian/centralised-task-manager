import type { ConnectorStatusDto, TaskSyncJobDto } from '@ctm/api-client';
import { Button } from '../ui/index.js';

type SourceCardProps = {
    connector: ConnectorStatusDto;
    onConnect: (source: string) => void;
    onDisconnect: (source: string) => void;
    onSync: (source: string) => void;
    onCancelSync: (source: string, jobId: string) => void;
    syncJob?: TaskSyncJobDto;
    isPending: boolean;
};

const STAGE_LABEL: Record<string, string> = {
    fetching: 'Fetching tasks…',
    upserting: 'Saving tasks…',
};

/** Displays a single connector with connect / disconnect / sync actions. */
export function SourceCard({
    connector,
    onConnect,
    onDisconnect,
    onSync,
    onCancelSync,
    syncJob,
    isPending,
}: SourceCardProps): React.JSX.Element {
    const { source, connected, lastSynced } = connector;
    const isSyncing = syncJob?.status === 'queued' || syncJob?.status === 'running';
    const syncFailed = syncJob?.status === 'failed';

    return (
        <div className="bg-white dark:bg-neutral-900 border-2 border-nb-black dark:border-white/20 shadow-[3px_3px_0px_#111] dark:shadow-none p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="font-black uppercase text-nb-black dark:text-white text-sm tracking-wide">{source}</p>
                    {connected && lastSynced && !isSyncing && (
                        <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">
                            Last synced: {new Date(lastSynced).toLocaleDateString()}
                        </p>
                    )}
                    {!connected && (
                        <p className="text-xs font-bold text-nb-black/50 dark:text-white/40 mt-0.5">Not connected</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {connected && !isSyncing && (
                        <Button
                            variant="secondary"
                            onClick={() => onSync(source)}
                            disabled={isPending}
                        >
                            Sync
                        </Button>
                    )}
                    {connected && isSyncing && (
                        <Button
                            variant="danger"
                            onClick={() => onCancelSync(source, syncJob!.id)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                    )}
                    {connected ? (
                        <Button variant="danger" onClick={() => onDisconnect(source)} disabled={isPending || isSyncing}>
                            Disconnect
                        </Button>
                    ) : (
                        <Button onClick={() => onConnect(source)} disabled={isPending}>
                            Connect
                        </Button>
                    )}
                </div>
            </div>

            {isSyncing && (
                <div className="w-full">
                    <p className="text-xs font-bold text-nb-black/60 dark:text-white/50 mb-1">
                        {syncJob?.stage ? STAGE_LABEL[syncJob.stage] ?? 'Working…' : 'Starting…'}
                    </p>
                    <div className="w-full h-1.5 bg-nb-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-nb-black dark:bg-white animate-pulse w-full" />
                    </div>
                </div>
            )}

            {syncFailed && (
                <p className="text-xs font-bold text-nb-red">
                    Sync failed: {syncJob?.error ?? 'Unknown error'}
                </p>
            )}

            {syncJob?.status === 'done' && (
                <p className="text-xs font-bold text-green-700 dark:text-green-400">
                    Synced {syncJob.synced} task{syncJob.synced !== 1 ? 's' : ''}
                    {syncJob.skipped > 0 ? `, skipped ${syncJob.skipped} (local changes preserved)` : ''}
                </p>
            )}
        </div>
    );
}
