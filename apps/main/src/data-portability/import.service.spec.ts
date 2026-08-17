import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { ImportService } from './import.service.js';
import {
    Notification,
    type NotificationDocument,
    NotificationSchema,
    Task,
    type TaskDocument,
    TaskSchema,
    User,
    type UserDocument,
    UserSchema,
} from '@ctm/db';
import type { ImportEnvelope, ImportTask } from './dto/import-envelope.schema.js';

function makeEnvelope(overrides: Partial<ImportEnvelope> = {}): ImportEnvelope {
    return {
        version: '1',
        exportId: 'test-export-id',
        part: 1,
        totalParts: 1,
        tasks: [],
        ...overrides,
    };
}

function makeTask(overrides: Partial<ImportTask> = {}): ImportTask {
    return {
        source: 'local',
        sourceId: `task-${Date.now()}`,
        title: 'Test Task',
        description: null,
        status: 'open',
        priority: null,
        tags: [],
        due: null,
        deadlineDate: null,
        duration: null,
        fuzzyDeadline: null,
        reminders: [],
        dueDateNotifiedAt: null,
        locations: [],
        syncedAt: new Date().toISOString(),
        ...overrides,
    };
}

describe('ImportService', () => {
    let module: TestingModule;
    let service: ImportService;
    let userModel: Model<UserDocument>;
    let taskModel: Model<TaskDocument>;
    let notificationModel: Model<NotificationDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: Task.name, schema: TaskSchema },
                    { name: Notification.name, schema: NotificationSchema },
                ]),
            ],
            providers: [ImportService],
        }).compile();

        service = module.get(ImportService);
        userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    });

    afterAll(() => module.close());

    it('rejects unknown version', async () => {
        const envelope = makeEnvelope({ version: '99' });
        await expect(
            service.import({ userId: new Types.ObjectId().toHexString(), envelopes: [envelope], onConflict: 'ignore' }),
        ).rejects.toThrow('Unsupported export version');
    });

    it('imports new tasks and returns correct summary', async () => {
        const ts = Date.now();
        const user = await userModel.create({ email: `import-new-${ts}@test.com`, passwordHash: 'x', name: 'New' });

        const result = await service.import({
            userId: String(user._id),
            envelopes: [makeEnvelope({ tasks: [makeTask({ sourceId: `new-task-${ts}` })] })],
            onConflict: 'ignore',
        });

        expect(result.imported.tasks).toBe(1);
        expect(result.skipped.tasks).toBe(0);

        const saved = await taskModel.findOne({ userId: user._id, sourceId: `new-task-${ts}` });
        expect(saved?.title).toBe('Test Task');
    });

    it('onConflict=ignore skips existing tasks', async () => {
        const ts = Date.now();
        const user = await userModel.create({ email: `import-ignore-${ts}@test.com`, passwordHash: 'x', name: 'Orig' });
        await taskModel.create({
            userId: user._id,
            source: 'local',
            sourceId: `t-${ts}`,
            title: 'Original',
            status: 'open',
            syncedAt: new Date(),
        });

        const result = await service.import({
            userId: String(user._id),
            envelopes: [makeEnvelope({ tasks: [makeTask({ sourceId: `t-${ts}`, title: 'Updated' })] })],
            onConflict: 'ignore',
        });

        expect(result.skipped.tasks).toBe(1);
        expect(result.imported.tasks).toBe(0);

        const task = await taskModel.findOne({ userId: user._id, source: 'local', sourceId: `t-${ts}` });
        expect(task?.title).toBe('Original');
    });

    it('onConflict=replace overwrites existing tasks', async () => {
        const ts = Date.now();
        const user = await userModel.create({ email: `import-replace-${ts}@test.com`, passwordHash: 'x', name: 'R' });
        await taskModel.create({
            userId: user._id,
            source: 'local',
            sourceId: `r-${ts}`,
            title: 'Old',
            status: 'open',
            syncedAt: new Date(),
        });

        const result = await service.import({
            userId: String(user._id),
            envelopes: [makeEnvelope({ tasks: [makeTask({ sourceId: `r-${ts}`, title: 'New Title' })] })],
            onConflict: 'replace',
        });

        expect(result.imported.tasks).toBe(1);

        const task = await taskModel.findOne({ userId: user._id, source: 'local', sourceId: `r-${ts}` });
        expect(task?.title).toBe('New Title');
    });

    it('ignores notifications and profile carried by the envelope', async () => {
        const ts = Date.now();
        const user = await userModel.create({ email: `import-skip-${ts}@test.com`, passwordHash: 'x', name: 'Keep' });
        const notifId = new Types.ObjectId();

        const result = await service.import({
            userId: String(user._id),
            envelopes: [
                {
                    ...makeEnvelope({ tasks: [makeTask({ sourceId: `skip-${ts}` })] }),
                    ...{
                        notifications: [{ id: notifId.toHexString(), type: 'reminder', title: 'N', body: 'B' }],
                        profile: { email: user.email, name: 'Changed' },
                    },
                },
            ],
            onConflict: 'replace',
        });

        expect(result.imported.tasks).toBe(1);
        expect(await notificationModel.findById(notifId)).toBeNull();
        expect((await userModel.findById(user._id))?.name).toBe('Keep');
    });
});
