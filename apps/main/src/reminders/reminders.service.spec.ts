import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { RemindersService } from './reminders.service.js';
import { Task, TaskSchema, type TaskDocument } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { User, UserSchema, type UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';

describe('RemindersService', () => {
    let module: TestingModule;
    let service: RemindersService;
    let taskModel: Model<TaskDocument>;
    const userId = new Types.ObjectId();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: Task.name, schema: TaskSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                    { name: User.name, schema: UserSchema },
                ]),
            ],
            providers: [
                RemindersService,
                UsersService,
                { provide: NotificationsService, useValue: { send: vi.fn().mockResolvedValue(undefined) } },
            ],
        }).compile();

        service = module.get(RemindersService);
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('getSurfacedTaskIds queries with daily on non-Monday', async () => {
        const tuesday = new Date('2026-05-19');
        vi.setSystemTime(tuesday);

        const now = Date.now();
        const dailyTask = await taskModel.create({
            userId,
            title: `Daily task ${now}`,
            source: 'local',
            sourceId: `daily-${now}`,
            syncedAt: new Date(),
            status: 'open',
            fuzzyDeadline: { type: 'this_week', remindEvery: 'daily' },
        });
        await taskModel.create({
            userId,
            title: `Weekly task ${now}`,
            source: 'local',
            sourceId: `weekly-${now}`,
            syncedAt: new Date(),
            status: 'open',
            fuzzyDeadline: { type: 'this_week', remindEvery: 'weekly' },
        });

        const ids = await service.getSurfacedTaskIds(String(userId));

        expect(ids).toContain(String(dailyTask._id));
        // weekly task for this userId should not appear on non-Monday
        const weeklySourceId = `weekly-${now}`;
        const weeklyDoc = await taskModel.findOne({ userId, sourceId: weeklySourceId });
        expect(ids).not.toContain(String(weeklyDoc?._id));
    });

    it('getSurfacedTaskIds includes weekly tasks on Monday', async () => {
        const monday = new Date('2026-05-18');
        vi.setSystemTime(monday);

        const mondayUserId = new Types.ObjectId();
        const now = Date.now();
        const dailyTask = await taskModel.create({
            userId: mondayUserId,
            title: `Daily monday ${now}`,
            source: 'local',
            sourceId: `daily-mon-${now}`,
            syncedAt: new Date(),
            status: 'open',
            fuzzyDeadline: { type: 'this_week', remindEvery: 'daily' },
        });
        const weeklyTask = await taskModel.create({
            userId: mondayUserId,
            title: `Weekly monday ${now}`,
            source: 'local',
            sourceId: `weekly-mon-${now}`,
            syncedAt: new Date(),
            status: 'open',
            fuzzyDeadline: { type: 'this_week', remindEvery: 'weekly' },
        });

        const ids = await service.getSurfacedTaskIds(String(mondayUserId));

        expect(ids).toContain(String(dailyTask._id));
        expect(ids).toContain(String(weeklyTask._id));
    });
});
