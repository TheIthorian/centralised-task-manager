import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model } from 'mongoose';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema, type TaskDocument } from './schemas/task.schema.js';
import { User, UserSchema, type UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';

describe('TasksService across timezones', () => {
    let service: TasksService;
    let taskModel: Model<TaskDocument>;
    let userModel: Model<UserDocument>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([
                    { name: Task.name, schema: TaskSchema },
                    { name: User.name, schema: UserSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                ]),
            ],
            providers: [TasksService, UsersService],
        }).compile();

        service = moduleRef.get(TasksService);
        taskModel = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
        userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stores a date-only due value as an all-day date pinned to UTC midnight', async () => {
        const user = await createUser('UTC');
        const task = await service.create({
            userId: String(user._id),
            dto: { title: 'Renew passport', source: 'local', due: { date: '2026-07-15' } } as CreateTaskDto,
        });

        expect(task.due?.allDay).toBe(true);
        expect(task.due?.date.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('keeps a wall-clock all-day date on its own day when the client sends an offset', async () => {
        const user = await createUser('UTC');
        const task = await service.create({
            userId: String(user._id),
            dto: {
                title: 'Renew insurance',
                source: 'local',
                // The 15th in Auckland, which as an instant is the 14th in UTC.
                due: { date: '2026-07-15T00:00:00+12:00', timezone: 'Pacific/Auckland', allDay: true },
            } as CreateTaskDto,
        });

        expect(task.due?.date.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it('stores a timed due value as the instant it names', async () => {
        const user = await createUser('Europe/London');
        const task = await service.create({
            userId: String(user._id),
            dto: {
                title: 'Standup',
                source: 'local',
                due: { date: '2026-07-15T09:00:00+01:00', timezone: 'Europe/London' },
            } as CreateTaskDto,
        });

        expect(task.due?.allDay).toBe(false);
        expect(task.due?.date.toISOString()).toBe('2026-07-15T08:00:00.000Z');
    });

    it('resolves the today filter against the caller own midnight', async () => {
        const stamp = Date.now();
        const inAuckland = await createUser('Pacific/Auckland');
        const inLosAngeles = await createUser('America/Los_Angeles');

        // 08:00Z on the 15th is 20:00 that evening in Auckland but only 01:00 on the 15th in Los
        // Angeles, whose day has not turned over yet at the moment the query runs.
        const dueInstant = new Date('2026-07-15T08:00:00.000Z');

        for (const user of [inAuckland, inLosAngeles]) {
            await taskModel.create({
                userId: user._id,
                title: `Filter probe ${stamp}`,
                source: 'local',
                sourceId: `probe-${stamp}-${String(user._id)}`,
                syncedAt: new Date(),
                status: 'open',
                due: { date: dueInstant, timezone: null, recurrence: null, allDay: false },
            });
        }

        vi.setSystemTime(new Date('2026-07-14T21:00:00.000Z'));

        const aucklandToday = await service.list(String(inAuckland._id), { filter: 'today' });
        const losAngelesToday = await service.list(String(inLosAngeles._id), { filter: 'today' });

        expect(aucklandToday).toHaveLength(1);
        expect(losAngelesToday).toHaveLength(0);
    });

    async function createUser(timezone: string): Promise<UserDocument> {
        return userModel.create({
            email: `tasks-tz-${timezone}-${Date.now()}-${Math.random()}@example.com`,
            passwordHash: 'x',
            timezone,
        });
    }
});
