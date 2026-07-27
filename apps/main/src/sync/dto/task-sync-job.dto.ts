import type { TaskSyncJobDto as ITaskSyncJobDto } from '@ctm/api-client';

/** Status snapshot of a background task-sync job. */
export class TaskSyncJobDto implements ITaskSyncJobDto {
    id!: string;
    type!: string;
    status!: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
    source!: string;
    connectionId!: string;
    stage!: 'fetching' | 'upserting' | null;
    synced!: number;
    skipped!: number;
    droppedOverQuota!: number;
    error!: string | null;
    completedAt!: string | null;
}
