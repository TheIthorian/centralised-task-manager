import { Test } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    ConnectorConfig,
    ConnectorConfigSchema,
    Job,
    JobSchema,
    Task,
    TaskSchema,
    User,
    UserSchema,
    type ConnectorConfigDocument,
    type JobDocument,
    type TaskDocument,
    type UserDocument,
} from '@ctm/db';
import { MetricsService } from './metrics.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Suites share one database and leave their rows behind, so every assertion is a delta against a
// baseline taken before this suite inserted anything, never an absolute count.
describe('MetricsService', () => {
    const run = Date.now();
    const source = `stub-${run}`;

    let metrics: MetricsService;
    let users: Model<UserDocument>;
    let tasks: Model<TaskDocument>;
    let connectors: Model<ConnectorConfigDocument>;
    let jobs: Model<JobDocument>;
    let userId: Types.ObjectId;

    let baseline: Awaited<ReturnType<MetricsService['siteMetrics']>>;
    let after: Awaited<ReturnType<MetricsService['siteMetrics']>>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, ignoreEnvVars: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: Task.name, schema: TaskSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                    { name: Job.name, schema: JobSchema },
                ]),
            ],
            providers: [MetricsService],
        }).compile();

        metrics = moduleRef.get(MetricsService);
        users = moduleRef.get(getModelToken(User.name));
        tasks = moduleRef.get(getModelToken(Task.name));
        connectors = moduleRef.get(getModelToken(ConnectorConfig.name));
        jobs = moduleRef.get(getModelToken(Job.name));

        baseline = await metrics.siteMetrics();

        const user = await users.create({
            email: `metrics+${run}@example.com`,
            passwordHash: 'x',
        });
        userId = user._id;

        await tasks.create([
            { userId, source, sourceId: `${run}-1`, title: 'open one', status: 'open', syncedAt: new Date() },
            { userId, source, sourceId: `${run}-2`, title: 'open two', status: 'open', syncedAt: new Date() },
            { userId, source, sourceId: `${run}-3`, title: 'done one', status: 'done', syncedAt: new Date() },
        ]);

        // ConnectorConfig.source is constrained to the ConnectorName enum, unlike Task.source.
        await connectors.create([
            {
                userId,
                source: 'todoist',
                externalAccountId: `${run}-healthy`,
                accessToken: 'x',
                tokenExpiresAt: new Date(),
                enabled: true,
            },
            {
                userId,
                source: 'todoist',
                externalAccountId: `${run}-broken`,
                accessToken: 'x',
                tokenExpiresAt: new Date(),
                enabled: false,
                lastError: 'token expired',
            },
        ]);

        await jobs.create([
            { userId, type: 'task-sync', status: 'done', completedAt: new Date() },
            { userId, type: 'task-sync', status: 'failed', error: 'boom' },
            { userId, type: 'task-sync', status: 'queued' },
        ]);

        after = await metrics.siteMetrics();
    });

    it('counts the new user', () => {
        expect(after.users.total - baseline.users.total).toBe(1);
        expect(after.users.createdLast7Days - baseline.users.createdLast7Days).toBe(1);
    });

    it('counts the new tasks', () => {
        expect(after.tasks.total - baseline.tasks.total).toBe(3);
    });

    it('buckets tasks by status', () => {
        expect(bucket(after.tasks.byStatus, 'open') - bucket(baseline.tasks.byStatus, 'open')).toBe(2);
        expect(bucket(after.tasks.byStatus, 'done') - bucket(baseline.tasks.byStatus, 'done')).toBe(1);
    });

    it('buckets tasks by source', () => {
        expect(bucket(after.tasks.bySource, source)).toBe(3);
    });

    it('counts connectors, and separates enabled from failing', () => {
        expect(after.connectors.total - baseline.connectors.total).toBe(2);
        expect(after.connectors.enabled - baseline.connectors.enabled).toBe(1);
        expect(after.connectors.failing - baseline.connectors.failing).toBe(1);
    });

    it('reports sync health from job status', () => {
        expect(after.sync.succeededLast24Hours - baseline.sync.succeededLast24Hours).toBe(1);
        expect(after.sync.failedLast24Hours - baseline.sync.failedLast24Hours).toBe(1);
        expect(after.sync.inFlight - baseline.sync.inFlight).toBe(1);
        expect(after.sync.lastSucceededAt).not.toBeNull();
    });

    it('stamps when the figures were computed', () => {
        expect(Date.parse(after.generatedAt)).toBeGreaterThan(0);
    });

    it('returns one growth point per day, including days with no activity', async () => {
        const { points } = await metrics.growthMetrics({ days: 7 });

        expect(points).toHaveLength(7);
        expect(points.map((point) => point.date)).toEqual([...points.map((point) => point.date)].sort());
    });

    it('attributes the new rows to today', async () => {
        const { points } = await metrics.growthMetrics({ days: 2 });
        const today = points.at(-1);

        expect(today?.date).toBe(new Date().toISOString().slice(0, 10));
        expect(today?.users).toBeGreaterThanOrEqual(1);
        expect(today?.tasks).toBeGreaterThanOrEqual(3);
    });

    it('excludes rows created before the window', async () => {
        // Each window is compared against its own baseline: a 7-day and a 90-day window hold
        // different amounts of pre-existing data, so their totals are not comparable to each other.
        const shortBefore = await totalUsers({ days: 7 });
        const longBefore = await totalUsers({ days: 90 });

        // insertOne rather than create: mongoose's timestamps would overwrite an explicit
        // createdAt, and backdating is the whole point of the row.
        await users.collection.insertOne({
            email: `metrics-old+${run}@example.com`,
            passwordHash: 'x',
            createdAt: new Date(Date.now() - 60 * DAY_MS),
            updatedAt: new Date(),
        });

        expect(await totalUsers({ days: 7 })).toBe(shortBefore);
        expect(await totalUsers({ days: 90 })).toBe(longBefore + 1);
    });

    async function totalUsers({ days }: { days: number }): Promise<number> {
        const { points } = await metrics.growthMetrics({ days });

        return points.reduce((sum, point) => sum + point.users, 0);
    }
});

function bucket(buckets: { key: string; count: number }[], key: string): number {
    return buckets.find((entry) => entry.key === key)?.count ?? 0;
}
