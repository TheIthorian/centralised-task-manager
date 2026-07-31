import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExternalTaskSourceRegistry } from '@ctm/connectors';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Job, JobSchema } from '../jobs/schemas/job.schema.js';
import {
    TASK_SYNC_JOB_MODEL,
    TaskSyncJobSchema,
    type TaskSyncJobDocument,
} from '../jobs/schemas/task-sync-job.schema.js';
import { Task, TaskSchema, type TaskDocument } from '../tasks/schemas/task.schema.js';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { SyncGateway } from './sync.gateway.js';
import { SyncService } from './sync.service.js';

describe('SyncService per connection', () => {
    let service: SyncService;
    let taskModel: Model<TaskDocument>;
    let jobModel: Model<TaskSyncJobDocument>;
    const userId = new Types.ObjectId().toString();
    const connectionId = new Types.ObjectId().toString();
    const externalAccountId = `acct-A-${Date.now()}`;

    const connectorsStub = {
        getConnectionForSync: vi.fn().mockResolvedValue({
            _id: connectionId,
            source: 'google_tasks',
            externalAccountId,
        }),
        ensureFreshTokens: vi.fn().mockResolvedValue({
            accessToken: 'a',
            refreshToken: 'r',
            expiresAt: new Date(Date.now() + 3600_000),
        }),
        getSettings: vi.fn().mockResolvedValue({}),
        updateLastSyncedAt: vi.fn().mockResolvedValue(undefined),
    };

    const registryStub = {
        get: vi.fn().mockReturnValue({
            fetchTasks: vi.fn().mockResolvedValue([
                {
                    sourceId: `r1-${Date.now()}`,
                    title: 'Remote task',
                    description: null,
                    status: 'open',
                    priority: null,
                    due: null,
                    deadline: null,
                    duration: null,
                    parentSourceId: null,
                    tags: [],
                },
            ]),
        }),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([
                    {
                        name: Job.name,
                        schema: JobSchema,
                        discriminators: [{ name: TASK_SYNC_JOB_MODEL, schema: TaskSyncJobSchema }],
                    },
                    { name: Task.name, schema: TaskSchema },
                    { name: User.name, schema: UserSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                ]),
            ],
            providers: [
                SyncService,
                TasksService,
                UsersService,
                { provide: ConnectorsService, useValue: connectorsStub },
                { provide: ExternalTaskSourceRegistry, useValue: registryStub },
                { provide: SyncGateway, useValue: { emitProgress: vi.fn() } },
            ],
        }).compile();

        service = moduleRef.get(SyncService);
        taskModel = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
        jobModel = moduleRef.get<Model<TaskSyncJobDocument>>(getModelToken(TASK_SYNC_JOB_MODEL));
    });

    it('createJob + runSync syncs a single connection and stamps its account', async () => {
        const job = await service.createJob({ userId, connectionId });

        expect(job.connectionId).toBe(connectionId);
        expect(job.source).toBe('google_tasks');

        let status = job.status as string;

        for (let i = 0; i < 50 && status !== 'done' && status !== 'failed'; i++) {
            await new Promise((resolve) => setTimeout(resolve, 100));

            const fresh = await service.getJob({ userId, jobId: String(job._id), connectionId });

            status = fresh.status;
        }

        expect(status).toBe('done');

        const tasks = await taskModel.find({ userId: new Types.ObjectId(userId), externalAccountId });

        expect(tasks).toHaveLength(1);
        expect(connectorsStub.ensureFreshTokens).toHaveBeenCalledWith({ userId, connectionId });
        expect(connectorsStub.updateLastSyncedAt).toHaveBeenCalledWith({ userId, connectionId });
    });

    it('getJob 404s when the job belongs to a different connection', async () => {
        const jobId = await seedJob();

        await expect(
            service.getJob({ userId, jobId, connectionId: new Types.ObjectId().toString() }),
        ).rejects.toMatchObject({ status: 404 });
    });

    it('getJob 404s for another user, matching the not-found status exactly', async () => {
        const jobId = await seedJob();

        await expect(
            service.getJob({ userId: new Types.ObjectId().toString(), jobId, connectionId }),
        ).rejects.toMatchObject({ status: 404 });
    });

    it('getJob 404s for an unknown job', async () => {
        await expect(
            service.getJob({ userId, jobId: new Types.ObjectId().toString(), connectionId }),
        ).rejects.toMatchObject({ status: 404 });
    });

    it('getJob returns the job under its own connection', async () => {
        const jobId = await seedJob();

        const job = await service.getJob({ userId, jobId, connectionId });

        expect(String(job._id)).toBe(jobId);
    });

    /** Inserts a queued job directly, so the lookup checks are tested without starting a background sync. */
    async function seedJob(): Promise<string> {
        const job = await jobModel.create({
            userId: new Types.ObjectId(userId),
            connectionId,
            source: 'google_tasks',
            status: 'queued',
            stage: null,
            synced: 0,
            skipped: 0,
            droppedOverQuota: 0,
        });

        return String(job._id);
    }
});
