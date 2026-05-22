import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorRegistry } from '@ctm/connectors';
import { Job } from '../jobs/schemas/job.schema.js';
import { TASK_SYNC_JOB_MODEL, type TaskSyncJobDocument } from '../jobs/schemas/task-sync-job.schema.js';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { SyncGateway } from './sync.gateway.js';

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(
        // Injected to ensure Mongoose registers the base Job model before the discriminator is used.
        @InjectModel(Job.name) _jobModel: Model<never>,
        @InjectModel(TASK_SYNC_JOB_MODEL) private readonly taskSyncModel: Model<TaskSyncJobDocument>,
        private readonly connectors: ConnectorsService,
        private readonly registry: ConnectorRegistry,
        private readonly tasks: TasksService,
        private readonly gateway: SyncGateway,
    ) {}

    /** Create a TaskSyncJob and start async execution. Returns the new job document. */
    async createJob({ userId, source }: { userId: string; source: string }): Promise<TaskSyncJobDocument> {
        const job = await this.taskSyncModel.create({
            userId: new Types.ObjectId(userId),
            source,
            status: 'queued',
            stage: null,
            synced: 0,
            skipped: 0,
        });

        void this.runSync(String(job._id), userId, source);

        return job;
    }

    /** Retrieve a job by ID. Throws 404 if not found, 403 if wrong user. */
    async getJob({ userId, jobId }: { userId: string; jobId: string }): Promise<TaskSyncJobDocument> {
        const job = await this.taskSyncModel.findById(jobId);

        if (!job) throw new NotFoundException('Sync job not found');

        if (String(job.userId) !== userId) throw new ForbiddenException('Access denied');

        return job;
    }

    /** Cancel a queued or running job. No-op if already terminal. */
    async cancelJob({ userId, jobId }: { userId: string; jobId: string }): Promise<void> {
        // Verify ownership first
        await this.getJob({ userId, jobId });

        // Atomic status-guarded update — prevents TOCTOU race with runSync completing
        const updated = await this.taskSyncModel.findOneAndUpdate(
            { _id: jobId, status: { $in: ['queued', 'running'] } },
            { status: 'cancelled', completedAt: new Date() },
            { new: true },
        );

        if (updated) this.gateway.emitProgress(userId, updated);
        // If updated is null, job was already terminal — no-op is intentional
    }

    private async runSync(jobId: string, userId: string, source: string): Promise<void> {
        const update = async (patch: Partial<TaskSyncJobDocument>): Promise<TaskSyncJobDocument | null> =>
            this.taskSyncModel.findByIdAndUpdate(jobId, patch, { new: true });

        try {
            let job = await update({ status: 'running', stage: 'fetching' });

            if (!job) return;

            this.gateway.emitProgress(userId, job);

            if (job.status === 'cancelled') return;

            const tokens = await this.connectors.getDecryptedTokens({ userId, source });
            const connector = this.registry.get(source);
            const remoteTasks = await connector.fetchTasks(tokens);

            job = await update({ stage: 'upserting' });

            if (!job || job.status === 'cancelled') return;

            this.gateway.emitProgress(userId, job);

            const { synced, skipped } = await this.tasks.upsertFromRemote({ userId, source, remoteTasks });

            // Re-fetch to check for cancellation that arrived during upsertFromRemote
            job = await this.taskSyncModel.findById(jobId);

            if (!job || job.status === 'cancelled') return;

            await this.connectors.updateLastSyncedAt({ userId, source });

            const finalJob = await this.taskSyncModel.findByIdAndUpdate(
                jobId,
                { status: 'done', stage: null, synced, skipped, completedAt: new Date() },
                { new: true },
            );

            if (finalJob) this.gateway.emitProgress(userId, finalJob);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            this.logger.error(`Sync failed jobId=${jobId} source=${source}: ${message}`);

            const failedJob = await this.taskSyncModel.findByIdAndUpdate(
                jobId,
                { status: 'failed', error: message, completedAt: new Date() },
                { new: true },
            );

            if (failedJob) this.gateway.emitProgress(userId, failedJob);
        }
    }
}
