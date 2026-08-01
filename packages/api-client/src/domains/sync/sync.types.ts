/** Status snapshot of a background task-sync job. */
export type TaskSyncJobDto = {
    id: string;
    type: string;
    status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
    source: string;
    connectionId: string;
    stage: 'fetching' | 'upserting' | null;
    synced: number;
    skipped: number;
    /** Remote tasks left unimported because the account hit its task cap. */
    droppedOverQuota: number;
    error: string | null;
    completedAt: string | null;
};

/** Parameters for {@link SyncClient.syncConnector}. */
export type SyncConnectorParams = {
    connectionId: string;
};

/** Parameters for {@link SyncClient.getSyncJob}. */
export type GetSyncJobParams = {
    connectionId: string;
    jobId: string;
};

/** Parameters for {@link SyncClient.cancelSyncJob}. */
export type CancelSyncJobParams = {
    connectionId: string;
    jobId: string;
};
