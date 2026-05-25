import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { RemindersService } from './reminders.service.js';
import { Task, TaskSchema, type TaskDocument } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('RemindersService – runPointInTimeReminders', () => {
    let module: TestingModule;
    let service: RemindersService;
    let taskModel: Model<TaskDocument>;
    let sendMock: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
        sendMock = vi.fn().mockResolvedValue(undefined);

        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: Task.name, schema: TaskSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                ]),
            ],
            providers: [
                RemindersService,
                { provide: NotificationsService, useValue: { send: sendMock } },
            ],
        }).compile();

        service = module.get(RemindersService);
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        sendMock.mockClear();
        vi.useRealTimers();
    });

    it('fires notification and marks firedAt for a reminder in the window', async () => {
        const now = Date.now();
        const remindAt = new Date(now - 60_000); // 1 minute ago — within the 5-min window
        const userId = new Types.ObjectId();

        const task = await taskModel.create({
            userId,
            source: 'local',
            sourceId: `pit-reminder-test-${now}`,
            title: 'Point-in-time reminder task',
            syncedAt: new Date(),
            reminders: [{ remindAt, firedAt: null }],
        });

        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
        await service.runPointInTimeReminders();

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: String(userId),
                type: 'reminder',
            }),
        );

        const updated = await taskModel.findById(task._id);

        expect(updated!.reminders[0]!.firedAt).not.toBeNull();
    });

    it('does not fire again for an already-fired reminder', async () => {
        const now = Date.now();
        const remindAt = new Date(now - 60_000);
        const userId = new Types.ObjectId();

        await taskModel.create({
            userId,
            source: 'local',
            sourceId: `pit-already-fired-${now}`,
            title: 'Already fired task',
            syncedAt: new Date(),
            reminders: [{ remindAt, firedAt: new Date(now - 30_000) }],
        });

        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
        await service.runPointInTimeReminders();

        expect(sendMock).not.toHaveBeenCalled();
    });

    it('fires due-date notification and sets dueDateNotifiedAt', async () => {
        const now = Date.now();
        const dueDate = new Date(now - 120_000); // 2 minutes ago — within window
        const userId = new Types.ObjectId();

        const task = await taskModel.create({
            userId,
            source: 'local',
            sourceId: `pit-due-date-${now}`,
            title: 'Due date task',
            syncedAt: new Date(),
            due: { date: dueDate, timezone: null, recurrence: null },
        });

        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
        await service.runPointInTimeReminders();

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: String(userId),
                type: 'reminder',
                title: expect.stringContaining('Due date task'),
            }),
        );

        const updated = await taskModel.findById(task._id);

        expect(updated!.dueDateNotifiedAt).not.toBeNull();
    });

    it('does not fire for a due date outside the window', async () => {
        const now = Date.now();
        const dueDate = new Date(now + 60_000); // 1 minute in the future — outside window
        const userId = new Types.ObjectId();

        await taskModel.create({
            userId,
            source: 'local',
            sourceId: `pit-future-due-${now}`,
            title: 'Future due task',
            syncedAt: new Date(),
            due: { date: dueDate, timezone: null, recurrence: null },
        });

        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
        await service.runPointInTimeReminders();

        expect(sendMock).not.toHaveBeenCalled();
    });
});
