import { Schema } from 'mongoose';
import type { JobDocument } from './job.schema.js';

export type SyncStage = 'fetching' | 'upserting';

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
