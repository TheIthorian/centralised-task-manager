import { Injectable, NotFoundException } from '@nestjs/common';
import { appLogger } from '../logging/app-logger.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorName, TaskConnectorName, ExternalTaskSourceRegistry } from '@ctm/connectors';
import { Job, TASK_SYNC_JOB_MODEL, type TaskSyncJobDocument } from '@ctm/db';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { TasksService } from '@ctm/domain';
import { SyncGateway } from './sync.gateway.js';

@Injectable()
export class SyncService {
    private readonly logger = appLogger(SyncService.name);

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
        const job = await this.createJobRecord({ userId, connectionId });

        void this.runSync(String(job._id), userId, connectionId);

        return job;
    }

    /** Create a TaskSyncJob and run it to completion. The scheduled sync uses this to pace connections one at a time. */
    async runJobToCompletion({ userId, connectionId }: { userId: string; connectionId: string }): Promise<void> {
        const job = await this.createJobRecord({ userId, connectionId });

        await this.runSync(String(job._id), userId, connectionId);
    }

    /** Retrieve a job by ID within a connection. Throws 404 when it does not exist, belongs to another user, or sits on another connection. */
    async getJob({
        userId,
        jobId,
        connectionId,
    }: {
        userId: string;
        jobId: string;
        connectionId: string;
    }): Promise<TaskSyncJobDocument> {
        const job = await this.taskSyncModel.findById(jobId);

        // One 404 for every miss: a distinct status for "owned by someone else" would confirm the job id exists.
        if (!job || String(job.userId) !== userId || job.connectionId !== connectionId) {
            throw new NotFoundException('Sync job not found');
        }

        return job;
    }

    /** Cancel a queued or running job. No-op if already terminal. */
    async cancelJob({
        userId,
        jobId,
        connectionId,
    }: {
        userId: string;
        jobId: string;
        connectionId: string;
    }): Promise<void> {
        // Verify ownership first
        await this.getJob({ userId, jobId, connectionId });

        // Atomic status-guarded update — prevents TOCTOU race with runSync completing
        const updated = await this.taskSyncModel.findOneAndUpdate(
            { _id: jobId, status: { $in: ['queued', 'running'] } },
            { status: 'cancelled', completedAt: new Date() },
            { new: true },
        );

        if (updated) this.gateway.emitProgress(userId, updated);
        // If updated is null, job was already terminal — no-op is intentional
    }

    private async createJobRecord({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<TaskSyncJobDocument> {
        const connection = await this.connectors.getConnectionForSync({ userId, connectionId });

        return this.taskSyncModel.create({
            userId: new Types.ObjectId(userId),
            connectionId,
            source: connection.source,
            status: 'queued',
            stage: null,
            synced: 0,
            skipped: 0,
            droppedOverQuota: 0,
        });
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

            this.logger.error({ err, jobId, connectionId, userId }, 'Sync job failed');

            const failedJob = await this.taskSyncModel.findByIdAndUpdate(
                jobId,
                { status: 'failed', error: message, completedAt: new Date() },
                { new: true },
            );

            if (failedJob) this.gateway.emitProgress(userId, failedJob);
        }
    }
}
