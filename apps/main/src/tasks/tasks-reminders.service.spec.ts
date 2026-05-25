import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema, type TaskDocument } from './schemas/task.schema.js';

describe('TasksService – reminders', () => {
    let module: TestingModule;
    let service: TasksService;
    let taskModel: Model<TaskDocument>;
    const userId = new Types.ObjectId();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
            providers: [TasksService],
        }).compile();

        service = module.get(TasksService);
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    afterAll(async () => {
        await module.close();
    });

    async function makeTask(): Promise<TaskDocument> {
        const now = Date.now();
        return taskModel.create({
            userId,
            source: 'local',
            sourceId: `reminder-svc-test-${now}`,
            title: 'Reminder service task',
            syncedAt: new Date(),
        });
    }

    it('addReminder appends a reminder with firedAt null', async () => {
        const task = await makeTask();
        const remindAt = new Date(Date.now() + 60_000).toISOString();

        const result = await service.addReminder({
            taskId: String(task._id),
            userId: String(userId),
            dto: { remindAt },
        });

        expect(result.remindAt).toBe(remindAt);
        expect(result.firedAt).toBeNull();

        const updated = await taskModel.findById(task._id);

        expect(updated!.reminders).toHaveLength(1);
    });

    it('addReminder throws NotFoundException for unknown task', async () => {
        await expect(
            service.addReminder({
                taskId: String(new Types.ObjectId()),
                userId: String(userId),
                dto: { remindAt: new Date().toISOString() },
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('removeReminder removes by index', async () => {
        const task = await makeTask();
        const remindAt1 = new Date(Date.now() + 60_000).toISOString();
        const remindAt2 = new Date(Date.now() + 120_000).toISOString();

        await service.addReminder({ taskId: String(task._id), userId: String(userId), dto: { remindAt: remindAt1 } });
        await service.addReminder({ taskId: String(task._id), userId: String(userId), dto: { remindAt: remindAt2 } });

        await service.removeReminder({ taskId: String(task._id), userId: String(userId), index: 0 });

        const updated = await taskModel.findById(task._id);

        expect(updated!.reminders).toHaveLength(1);
        expect(updated!.reminders[0]!.remindAt.toISOString()).toBe(remindAt2);
    });

    it('removeReminder throws BadRequestException for out-of-range index', async () => {
        const task = await makeTask();

        await expect(
            service.removeReminder({ taskId: String(task._id), userId: String(userId), index: 5 }),
        ).rejects.toThrow(BadRequestException);
    });
});
