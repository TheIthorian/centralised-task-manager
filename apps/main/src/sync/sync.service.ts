import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorName, TaskConnectorName, ExternalTaskSourceRegistry } from '@ctm/connectors';
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
        private readonly registry: ExternalTaskSourceRegistry,
        private readonly tasks: TasksService,
        private readonly gateway: SyncGateway,
    ) {}

    /** Create a TaskSyncJob for a connection and start async execution. Returns the new job document. */
    async createJob({ userId, connectionId }: { userId: string; connectionId: string }): Promise<TaskSyncJobDocument> {
        const connection = await this.connectors.getConnectionForSync({ userId, connectionId });

        const job = await this.taskSyncModel.create({
            userId: new Types.ObjectId(userId),
            connectionId,
            source: connection.source,
            status: 'queued',
            stage: null,
            synced: 0,
            skipped: 0,
            droppedOverQuota: 0,
        });

        void this.runSync(String(job._id), userId, connectionId);

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

    private async runSync(jobId: string, userId: string, connectionId: string): Promise<void> {
        const update = async (patch: Partial<TaskSyncJobDocument>): Promise<TaskSyncJobDocument | null> =>
            this.taskSyncModel.findByIdAndUpdate(jobId, patch, { new: true });

        try {
            let job = await update({ status: 'running', stage: 'fetching' });

            if (!job) return;

            this.gateway.emitProgress(userId, job);

            if (job.status === 'cancelled') return;

            const connection = await this.connectors.getConnectionForSync({ userId, connectionId });
            const source = connection.source as ConnectorName;
            const tokens = await this.connectors.ensureFreshTokens({ userId, connectionId });
            const settings = await this.connectors.getSettings({ userId, connectionId });
            const connector = this.registry.get(source as unknown as TaskConnectorName);
            const remoteTasks = await connector.fetchTasks(tokens, settings);

            job = await update({ stage: 'upserting' });

            if (!job || job.status === 'cancelled') return;

            this.gateway.emitProgress(userId, job);

            const { synced, skipped, droppedOverQuota } = await this.tasks.upsertFromRemote({
                userId,
                source: source as unknown as TaskConnectorName,
                externalAccountId: connection.externalAccountId ?? '',
                remoteTasks,
            });

            // Re-fetch to check for cancellation that arrived during upsertFromRemote
            job = await this.taskSyncModel.findById(jobId);

            if (!job || job.status === 'cancelled') return;

            await this.connectors.updateLastSyncedAt({ userId, connectionId });

            const finalJob = await this.taskSyncModel.findByIdAndUpdate(
                jobId,
                { status: 'done', stage: null, synced, skipped, droppedOverQuota, completedAt: new Date() },
                { new: true },
            );

            if (finalJob) this.gateway.emitProgress(userId, finalJob);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            this.logger.error(`Sync failed jobId=${jobId} connectionId=${connectionId}: ${message}`);

            const failedJob = await this.taskSyncModel.findByIdAndUpdate(
                jobId,
                { status: 'failed', error: message, completedAt: new Date() },
                { new: true },
            );

            if (failedJob) this.gateway.emitProgress(userId, failedJob);
        }
    }
}
