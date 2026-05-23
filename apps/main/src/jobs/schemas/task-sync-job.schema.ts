import { Schema } from 'mongoose';
import type { JobDocument } from './job.schema.js';

/** Injection token for the TaskSyncJob discriminator model. */
export const TASK_SYNC_JOB_MODEL = 'task-sync';

/** Current processing stage of a task-sync job. */
export type SyncStage = 'fetching' | 'upserting';

/** Hydrated Mongoose document type for a TaskSyncJob discriminator. */
export type TaskSyncJobDocument = JobDocument & {
	type: 'task-sync';
	source: string;
	stage: SyncStage | null;
	synced: number;
	skipped: number;
};

export const TaskSyncJobSchema = new Schema({
	source: { type: String, required: true, maxlength: 50 },
	stage: { type: String, enum: ['fetching', 'upserting'], default: null },
	synced: { type: Number, default: 0 },
	skipped: { type: Number, default: 0 },
});
