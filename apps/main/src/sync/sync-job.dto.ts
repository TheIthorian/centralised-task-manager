import type { TaskSyncJobDocument } from '../jobs/schemas/task-sync-job.schema.js';

export type SyncJobDto = {
    id: string;
    type: string;
    status: string;
    source: string;
    stage: string | null;
    synced: number;
    skipped: number;
    error: string | null;
    completedAt: string | null;
};

/** Serialize a TaskSyncJobDocument to the wire DTO. */
export function toSyncJobDto(job: TaskSyncJobDocument): SyncJobDto {
    return {
        id: String(job._id),
        type: job.type,
        status: job.status,
        source: job.source,
        stage: job.stage,
        synced: job.synced,
        skipped: job.skipped,
        error: job.error,
        completedAt: job.completedAt?.toISOString() ?? null,
    };
}
