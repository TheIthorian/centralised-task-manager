import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Task, TaskSchema, type TaskDocument } from './task.schema.js';

describe('Task schema – reminder fields', () => {
    let module: TestingModule;
    let taskModel: Model<TaskDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
        }).compile();
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('defaults reminders to [] and dueDateNotifiedAt to null', async () => {
        const now = Date.now();
        const task = await taskModel.create({
            userId: new Types.ObjectId(),
            source: 'local',
            sourceId: `reminder-schema-test-${now}`,
            title: 'Schema test task',
            syncedAt: new Date(),
        });

        expect(task.reminders).toEqual([]);
        expect(task.dueDateNotifiedAt).toBeNull();
    });

    it('persists a reminder subdoc with remindAt and firedAt null', async () => {
        const now = Date.now();
        const remindAt = new Date(now + 60_000);
        const task = await taskModel.create({
            userId: new Types.ObjectId(),
            source: 'local',
            sourceId: `reminder-schema-test2-${now}`,
            title: 'Schema reminder task',
            syncedAt: new Date(),
            reminders: [{ remindAt, firedAt: null }],
        });

        expect(task.reminders).toHaveLength(1);
        expect(task.reminders[0]!.remindAt.toISOString()).toBe(remindAt.toISOString());
        expect(task.reminders[0]!.firedAt).toBeNull();
    });
});
