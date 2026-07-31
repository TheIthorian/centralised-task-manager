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

const sendMock = vi.fn().mockResolvedValue(undefined);

describe('RemindersService across timezones', () => {
    let module: TestingModule;
    let service: RemindersService;
    let taskModel: Model<TaskDocument>;
    let userModel: Model<UserDocument>;

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
                { provide: NotificationsService, useValue: { send: sendMock } },
            ],
        }).compile();

        service = module.get(RemindersService);
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
        userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
    });

    afterAll(async () => {
        await module.close();
    });

    afterEach(() => {
        vi.useRealTimers();
        sendMock.mockClear();
    });

    it('sends the daily digest at 09:00 on the reader own clock, not the server clock', async () => {
        const stamp = Date.now();
        const inLondon = await createUser({ timezone: 'Europe/London', stamp: `london-${stamp}` });
        const inAuckland = await createUser({ timezone: 'Pacific/Auckland', stamp: `auckland-${stamp}` });

        await createSurfacedTask({ userId: inLondon._id, stamp: `london-${stamp}` });
        await createSurfacedTask({ userId: inAuckland._id, stamp: `auckland-${stamp}` });

        // 08:00Z in July is 09:00 in London and 20:00 in Auckland.
        vi.setSystemTime(new Date('2026-07-15T08:00:00.000Z'));

        await service.runDailyReminders();

        const notified = sendMock.mock.calls.map((call) => (call[0] as { userId: string }).userId);

        expect(notified).toContain(String(inLondon._id));
        expect(notified).not.toContain(String(inAuckland._id));
    });

    it('sends the same digest twelve hours later for the reader on the other side of the world', async () => {
        const stamp = Date.now();
        const inAuckland = await createUser({ timezone: 'Pacific/Auckland', stamp: `nz-${stamp}` });

        await createSurfacedTask({ userId: inAuckland._id, stamp: `nz-${stamp}` });

        // 21:00Z on the 14th is 09:00 on the 15th in Auckland.
        vi.setSystemTime(new Date('2026-07-14T21:00:00.000Z'));

        await service.runDailyReminders();

        const notified = sendMock.mock.calls.map((call) => (call[0] as { userId: string }).userId);

        expect(notified).toContain(String(inAuckland._id));
    });

    it('surfaces weekly tasks on the reader Monday, not the server Monday', async () => {
        const stamp = Date.now();
        const inLosAngeles = await createUser({ timezone: 'America/Los_Angeles', stamp: `la-${stamp}` });
        const weekly = await createSurfacedTask({
            userId: inLosAngeles._id,
            stamp: `la-${stamp}`,
            remindEvery: 'weekly',
        });

        // 04:00Z on Monday 13 July is still 21:00 on Sunday in Los Angeles.
        vi.setSystemTime(new Date('2026-07-13T04:00:00.000Z'));
        expect(await service.getSurfacedTaskIds(String(inLosAngeles._id))).not.toContain(String(weekly._id));

        // 16:00Z the same day is 09:00 Monday there.
        vi.setSystemTime(new Date('2026-07-13T16:00:00.000Z'));
        expect(await service.getSurfacedTaskIds(String(inLosAngeles._id))).toContain(String(weekly._id));
    });

    it('fires an all-day due-date reminder at 09:00 in the owner zone', async () => {
        const stamp = Date.now();
        const inNewYork = await createUser({ timezone: 'America/New_York', stamp: `ny-${stamp}` });
        const task = await taskModel.create({
            userId: inNewYork._id,
            title: `All day ${stamp}`,
            source: 'local',
            sourceId: `allday-${stamp}`,
            syncedAt: new Date(),
            status: 'open',
            due: { date: new Date('2026-07-15T00:00:00.000Z'), timezone: null, recurrence: null, allDay: true },
        });

        // UTC midnight is 20:00 the previous evening in New York: too early.
        vi.setSystemTime(new Date('2026-07-15T00:02:00.000Z'));
        await service.runPointInTimeReminders();
        expect(sendMock).not.toHaveBeenCalled();

        // 09:00 in New York is 13:00Z in July.
        vi.setSystemTime(new Date('2026-07-15T13:02:00.000Z'));
        await service.runPointInTimeReminders();

        const notified = sendMock.mock.calls.map((call) => (call[0] as { data: { taskId?: string } }).data.taskId);

        expect(notified).toContain(String(task._id));
    });

    it('fires a timed due-date reminder on its instant, whatever the owner zone', async () => {
        const stamp = Date.now();
        const inNewYork = await createUser({ timezone: 'America/New_York', stamp: `nyt-${stamp}` });
        const task = await taskModel.create({
            userId: inNewYork._id,
            title: `Timed ${stamp}`,
            source: 'local',
            sourceId: `timed-${stamp}`,
            syncedAt: new Date(),
            status: 'open',
            due: {
                date: new Date('2026-07-15T15:30:00.000Z'),
                timezone: 'America/New_York',
                recurrence: null,
                allDay: false,
            },
        });

        vi.setSystemTime(new Date('2026-07-15T15:32:00.000Z'));
        await service.runPointInTimeReminders();

        const notified = sendMock.mock.calls.map((call) => (call[0] as { data: { taskId?: string } }).data.taskId);

        expect(notified).toContain(String(task._id));
    });

    async function createUser({ timezone, stamp }: { timezone: string; stamp: string }): Promise<UserDocument> {
        return userModel.create({ email: `tz-${stamp}@example.com`, passwordHash: 'x', timezone });
    }

    async function createSurfacedTask({
        userId,
        stamp,
        remindEvery = 'daily',
    }: {
        userId: Types.ObjectId;
        stamp: string;
        remindEvery?: 'daily' | 'weekly';
    }): Promise<TaskDocument> {
        return taskModel.create({
            userId,
            title: `Surfaced ${stamp}`,
            source: 'local',
            sourceId: `surfaced-${stamp}-${remindEvery}`,
            syncedAt: new Date(),
            status: 'open',
            fuzzyDeadline: { type: 'someday', remindEvery },
        });
    }
});
