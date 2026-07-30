import { ConnectorType } from '@ctm/api-client';
import type { ConnectorAccountDto, ConnectorStatusDto, ConnectorHealthDto, TaskSyncJobDto } from '@ctm/api-client';
import { BrandIcon, Button } from '@ctm/ui';
import { getSourceLabel, getSourceBrand } from '../../lib/source-labels.js';

type SourceCardProps = {
    connector: ConnectorStatusDto;
    onConnect: (source: string) => void;
    onDisconnect: (connectionId: string) => void;
    onSync: (connectionId: string) => void;
    onCancelSync: (connectionId: string, jobId: string) => void;
    onConfigure?: (connectionId: string) => void;
    onTest?: (source: string) => void;
    syncJobs: Map<string, TaskSyncJobDto>;
    healthByConnection?: Map<string, ConnectorHealthDto>;
    isPending: boolean;
    isHealthLoading?: boolean;
};

const STAGE_LABEL: Record<string, string> = {
    fetching: 'Fetching tasks…',
    upserting: 'Saving tasks…',
};

type AccountRowProps = {
    connector: ConnectorStatusDto;
    account: ConnectorAccountDto;
    onConnect: (source: string) => void;
    onDisconnect: (connectionId: string) => void;
    onSync: (connectionId: string) => void;
    onCancelSync: (connectionId: string, jobId: string) => void;
    onConfigure?: (connectionId: string) => void;
    onTest?: (source: string) => void;
    syncJob?: TaskSyncJobDto;
    health?: ConnectorHealthDto;
    isPending: boolean;
    isHealthLoading: boolean;
};

/** One connected account within a source group, with per-account actions. */
function AccountRow({
    connector,
    account,
    onConnect,
    onDisconnect,
    onSync,
    onCancelSync,
    onConfigure,
    onTest,
    syncJob,
    health,
    isPending,
    isHealthLoading,
}: AccountRowProps): React.JSX.Element {
    const { source, connectorType } = connector;
    const { connectionId, setupRequired, lastSynced } = account;
    const isTaskSync = connectorType === ConnectorType.TaskSync;
    const isSyncing = syncJob?.status === 'queued' || syncJob?.status === 'running';
    const syncFailed = syncJob?.status === 'failed';
    const isUnhealthy = health !== undefined && !health.healthy;
    const accountName = account.email ?? account.label ?? account.externalAccountId;

    return (
        <div className="flex flex-col gap-2 border-t border-line/10 pt-3">
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="min-w-0">
                    <p className="font-bold text-sm text-fg break-words">{accountName}</p>
                    {lastSynced && !isSyncing && (
                        <p className="text-xs font-bold text-muted mt-0.5">
                            Last synced: {new Date(lastSynced).toLocaleDateString()}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:shrink-0">
                    {setupRequired && onConfigure && (
                        <Button variant="secondary" onClick={() => onConfigure(connectionId)} disabled={isPending}>
                            Configure
                        </Button>
                    )}
                    {!isTaskSync && onTest && (
                        <Button variant="secondary" onClick={() => onTest(source)} disabled={isPending}>
                            Test
                        </Button>
                    )}
                    {isTaskSync && !isSyncing && isHealthLoading && (
                        <Button variant="secondary" disabled>
                            Checking…
                        </Button>
                    )}
                    {isTaskSync && !isSyncing && !isHealthLoading && isUnhealthy && (
                        <Button onClick={() => onConnect(source)} disabled={isPending}>
                            Reconnect
                        </Button>
                    )}
                    {isTaskSync && !isSyncing && !isHealthLoading && !isUnhealthy && (
                        <Button variant="secondary" onClick={() => onSync(connectionId)} disabled={isPending}>
                            Sync
                        </Button>
                    )}
                    {isTaskSync && isSyncing && (
                        <Button
                            variant="danger"
                            onClick={() => onCancelSync(connectionId, syncJob!.id)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                    )}
                    <Button variant="danger" onClick={() => onDisconnect(connectionId)} disabled={isPending || isSyncing}>
                        Disconnect
                    </Button>
                </div>
            </div>

            {setupRequired && (
                <p className="text-xs font-bold text-warn">
                    Setup incomplete — click Configure to finish connecting.
                </p>
            )}

            {isUnhealthy && (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Connection issue — reconnect to restore sync.
                </p>
            )}

            {isSyncing && (
                <div className="w-full">
                    <p className="text-xs font-bold text-muted mb-1">
                        {syncJob?.stage ? (STAGE_LABEL[syncJob.stage] ?? 'Working…') : 'Starting…'}
                    </p>
                    <div className="w-full h-1.5 bg-fg/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-accent animate-pulse w-full" />
                    </div>
                </div>
            )}

            {syncFailed && (
                <p className="text-xs font-bold text-warn">Sync failed: {syncJob?.error ?? 'Unknown error'}</p>
            )}

            {syncJob?.status === 'done' && (
                <>
                    <p className="text-xs font-bold text-green-700 dark:text-green-400">
                        Synced {syncJob.synced} task{syncJob.synced !== 1 ? 's' : ''}
                        {syncJob.skipped > 0 ? `, skipped ${syncJob.skipped} (local changes preserved)` : ''}
                    </p>
                    {syncJob.droppedOverQuota > 0 && (
                        <p className="text-xs font-bold text-warn">
                            Task limit reached — {syncJob.droppedOverQuota} task
                            {syncJob.droppedOverQuota !== 1 ? 's' : ''} not imported. Delete some tasks, then sync
                            again.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

/** Displays a source group with a row per connected account plus connect / add-account actions. */
export function SourceCard({
    connector,
    onConnect,
    onDisconnect,
    onSync,
    onCancelSync,
    onConfigure,
    onTest,
    syncJobs,
    healthByConnection,
    isPending,
    isHealthLoading = false,
}: SourceCardProps): React.JSX.Element {
    const { source, accounts } = connector;
    const brand = getSourceBrand(source);
    const sourceLabel = getSourceLabel(source);
    const hasAccounts = accounts.length > 0;

    return (
        <div className="bg-panel border border-line p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="font-semibold text-fg text-sm tracking-wide flex items-center gap-2">
                        {brand && <BrandIcon brand={brand} />}
                        {sourceLabel}
                    </p>
                    {!hasAccounts && (
                        <p className="text-xs font-bold text-muted mt-0.5">Not connected</p>
                    )}
                </div>

                {!hasAccounts && (
                    <Button onClick={() => onConnect(source)} disabled={isPending}>
                        Connect
                    </Button>
                )}
            </div>

            {accounts.map((account) => (
                <AccountRow
                    key={account.connectionId}
                    connector={connector}
                    account={account}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onSync={onSync}
                    onCancelSync={onCancelSync}
                    onConfigure={onConfigure}
                    onTest={onTest}
                    syncJob={syncJobs.get(account.connectionId)}
                    health={healthByConnection?.get(account.connectionId)}
                    isPending={isPending}
                    isHealthLoading={isHealthLoading}
                />
            ))}

            {hasAccounts && (
                <div>
                    <Button variant="secondary" onClick={() => onConnect(source)} disabled={isPending}>
                        + Add account
                    </Button>
                </div>
            )}
        </div>
    );
}
