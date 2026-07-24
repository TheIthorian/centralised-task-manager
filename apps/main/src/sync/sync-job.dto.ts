import type { TaskSyncJobDto } from '@ctm/api-client';
import type { TaskSyncJobDocument } from '../jobs/schemas/task-sync-job.schema.js';

/** Serialize a TaskSyncJobDocument to the wire DTO. */
export function toSyncJobDto(job: TaskSyncJobDocument): TaskSyncJobDto {
    return {
        id: String(job._id),
        type: job.type,
        status: job.status,
        source: job.source,
        connectionId: job.connectionId,
        stage: job.stage,
        synced: job.synced,
        skipped: job.skipped,
        error: job.error,
        completedAt: job.completedAt?.toISOString() ?? null,
    };
}
