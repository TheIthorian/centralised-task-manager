import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaskConnectorName } from '@ctm/connectors';
import { TasksService } from '@ctm/domain';
import { Task, TaskSchema, type TaskDocument } from '@ctm/db';

describe('TasksService upsertFromRemote', () => {
    let service: TasksService;
    let taskModel: Model<TaskDocument>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
        }).compile();

        taskModel = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
        service = new TasksService({ taskModel });

        // Drop the pre-multi-account unique index so the schema's account-scoped index applies.
        await taskModel.syncIndexes();
    });

    it('upsertFromRemote stamps externalAccountId and isolates accounts', async () => {
        const userId = new Types.ObjectId().toString();
        const remote = {
            sourceId: 'r1',
            title: 'T',
            description: null,
            status: 'open' as const,
            priority: null,
            due: null,
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: [],
        };

        await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId: 'acct-A',
            remoteTasks: [remote],
        });
        await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId: 'acct-B',
            remoteTasks: [remote],
        });

        const tasks = await taskModel.find({
            userId: new Types.ObjectId(userId),
            source: 'google_tasks',
            sourceId: 'r1',
        });

        expect(tasks).toHaveLength(2);
        expect(tasks.map((t) => t.externalAccountId).sort()).toEqual(['acct-A', 'acct-B']);
    });

    it('upsertFromRemote updates within the same account without duplicating', async () => {
        const userId = new Types.ObjectId().toString();
        const remote = {
            sourceId: 'r2',
            title: 'Before',
            description: null,
            status: 'open' as const,
            priority: null,
            due: null,
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: [],
        };

        await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId: 'acct-A',
            remoteTasks: [remote],
        });
        await service.upsertFromRemote({
            userId,
            source: TaskConnectorName.GoogleTasks,
            externalAccountId: 'acct-A',
            remoteTasks: [{ ...remote, title: 'After' }],
        });

        const tasks = await taskModel.find({
            userId: new Types.ObjectId(userId),
            source: 'google_tasks',
            sourceId: 'r2',
        });

        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.title).toBe('After');
    });
});
