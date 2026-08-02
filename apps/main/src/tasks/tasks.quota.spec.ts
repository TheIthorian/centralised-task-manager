import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { QuotaExceededError } from '@ctm/errors';
import { TaskConnectorName } from '@ctm/connectors';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema, type TaskDocument } from './schemas/task.schema.js';

// The real cap is far too large to fill from a test, so the constant module is stubbed.
// vi.mock is hoisted above every const, so the value is inlined rather than referenced.
vi.mock('../config/limits.js', () => ({ MAX_TASKS_PER_USER: 3, MAX_CONNECTIONS_PER_CONNECTOR: 5 }));

const MAX_TASKS = 3;

describe('TasksService task cap', () => {
    let service: TasksService;
    let taskModel: Model<TaskDocument>;

    const remoteTask = (sourceId: string) => ({
        sourceId,
        title: `remote ${sourceId}`,
        description: null,
        status: 'open' as const,
        priority: null,
        due: null,
        deadline: null,
        duration: null,
        parentSourceId: null,
        tags: [],
    });

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
            providers: [TasksService],
        }).compile();

        service = moduleRef.get(TasksService);
        taskModel = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    it('rejects a create once the cap is reached', async () => {
        const userId = new Types.ObjectId().toString();

        for (let i = 0; i < MAX_TASKS; i++) {
            await service.create({ userId, dto: { title: `task ${i}`, source: 'local' } });
        }

        await expect(
            service.create({ userId, dto: { title: 'one too many', source: 'local' } }),
        ).rejects.toBeInstanceOf(QuotaExceededError);
    });

    it('stops inserting new tasks from a sync at the cap and reports how many were dropped', async () => {
        const userId = new Types.ObjectId().toString();
        const stamp = Date.now();

        const result = await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId: `acct-${stamp}`,
            remoteTasks: Array.from({ length: MAX_TASKS + 2 }, (_unused, i) => remoteTask(`r-${stamp}-${i}`)),
        });

        expect(result).toEqual({ synced: MAX_TASKS, skipped: 0, droppedOverQuota: 2 });
        expect(await taskModel.countDocuments({ userId: new Types.ObjectId(userId) })).toBe(MAX_TASKS);
    });

    it('still applies updates to existing tasks when the account is at the cap', async () => {
        const userId = new Types.ObjectId().toString();
        const stamp = Date.now();
        const sourceIds = Array.from({ length: MAX_TASKS }, (_unused, i) => `u-${stamp}-${i}`);
        const externalAccountId = `acct-update-${stamp}`;

        await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId,
            remoteTasks: sourceIds.map(remoteTask),
        });

        const renamed = sourceIds.map((sourceId) => ({ ...remoteTask(sourceId), title: `renamed ${sourceId}` }));
        const result = await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId,
            remoteTasks: renamed,
        });

        expect(result).toEqual({ synced: MAX_TASKS, skipped: 0, droppedOverQuota: 0 });

        const stored = await taskModel.findOne({ userId: new Types.ObjectId(userId), sourceId: sourceIds[0] });

        expect(stored?.title).toBe(`renamed ${sourceIds[0]}`);
    });
});
