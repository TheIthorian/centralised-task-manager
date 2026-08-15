import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema, type TaskDocument } from '@ctm/db';

describe('TasksService relations', () => {
    let service: TasksService;
    let model: Model<TaskDocument>;
    const userId = new Types.ObjectId().toHexString();

    const makeTask = async (title: string): Promise<TaskDocument> =>
        model.create({
            userId: new Types.ObjectId(userId),
            source: 'local',
            sourceId: new Types.ObjectId().toHexString(),
            title,
            status: 'open',
            syncedAt: new Date(),
        });

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
            providers: [TasksService],
        }).compile();

        service = moduleRef.get(TasksService);
        model = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    it('addRelation writes both sides with inverse type', async () => {
        const a = await makeTask('A-' + Date.now());
        const b = await makeTask('B-' + Date.now());

        await service.addRelation({ userId, taskId: String(a._id), type: 'parent', targetTaskId: String(b._id) });

        const fa = await model.findById(a._id);
        const fb = await model.findById(b._id);

        expect(fa!.relations).toHaveLength(1);
        expect(fa!.relations[0]!.type).toBe('parent');
        expect(String(fa!.relations[0]!.targetTaskId)).toBe(String(b._id));

        expect(fb!.relations).toHaveLength(1);
        expect(fb!.relations[0]!.type).toBe('child');
        expect(String(fb!.relations[0]!.targetTaskId)).toBe(String(a._id));
    });

    it('addRelation is idempotent (no duplicate pair)', async () => {
        const a = await makeTask('A2-' + Date.now());
        const b = await makeTask('B2-' + Date.now());

        const args = { userId, taskId: String(a._id), type: 'related' as const, targetTaskId: String(b._id) };

        await service.addRelation(args);
        await service.addRelation(args);

        const fa = await model.findById(a._id);

        expect(fa!.relations).toHaveLength(1);
    });

    it('removeRelation clears both sides', async () => {
        const a = await makeTask('A3-' + Date.now());
        const b = await makeTask('B3-' + Date.now());

        await service.addRelation({ userId, taskId: String(a._id), type: 'next', targetTaskId: String(b._id) });
        await service.removeRelation({ userId, taskId: String(a._id), type: 'next', targetTaskId: String(b._id) });

        const fa = await model.findById(a._id);
        const fb = await model.findById(b._id);

        expect(fa!.relations).toHaveLength(0);
        expect(fb!.relations).toHaveLength(0);
    });

    it('rejects a self-relation', async () => {
        const a = await makeTask('A4-' + Date.now());

        await expect(
            service.addRelation({ userId, taskId: String(a._id), type: 'related', targetTaskId: String(a._id) }),
        ).rejects.toThrow();
    });

    it('rejects relating to another user task', async () => {
        const a = await makeTask('A5-' + Date.now());
        const other = await model.create({
            userId: new Types.ObjectId(),
            source: 'local',
            sourceId: new Types.ObjectId().toHexString(),
            title: 'other',
            status: 'open',
            syncedAt: new Date(),
        });

        await expect(
            service.addRelation({ userId, taskId: String(a._id), type: 'parent', targetTaskId: String(other._id) }),
        ).rejects.toThrow();
    });

    it('removes dangling relations when a task is deleted', async () => {
        const a = await makeTask('A6-' + Date.now());
        const b = await makeTask('B6-' + Date.now());

        await service.addRelation({ userId, taskId: String(a._id), type: 'parent', targetTaskId: String(b._id) });
        await service.remove({ taskId: String(b._id), userId });

        const fa = await model.findById(a._id);

        expect(fa!.relations).toHaveLength(0);
    });
});
