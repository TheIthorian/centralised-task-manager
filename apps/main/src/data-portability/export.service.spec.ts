import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model } from 'mongoose';
import { ExportService } from './export.service.js';
import { FilesService } from '../files/files.service.js';
import { Export, ExportSchema, type ExportDocument } from './schemas/export.schema.js';
import { User, UserSchema, type UserDocument } from '../users/schemas/user.schema.js';
import { Task, TaskSchema, type TaskDocument } from '../tasks/schemas/task.schema.js';
import {
    Notification,
    NotificationSchema,
    type NotificationDocument,
} from '../notifications/schemas/notification.schema.js';

const mockFilesService = {
    save: vi
        .fn()
        .mockImplementation(
            async ({
                prefix,
                filename,
                data,
                contentType,
            }: {
                prefix: string;
                filename: string;
                data: Buffer;
                contentType: string;
            }) => ({
                storagePath: `${prefix}/${filename}`,
                filename,
                sizeBytes: data.length,
                contentType,
                sha256: 'deadbeef'.repeat(8),
            }),
        ),
    readByPath: vi.fn(),
    deletePrefix: vi.fn(),
};

describe('ExportService', () => {
    let module: TestingModule;
    let service: ExportService;
    let userModel: Model<UserDocument>;
    let taskModel: Model<TaskDocument>;
    let notificationModel: Model<NotificationDocument>;
    let exportModel: Model<ExportDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: Task.name, schema: TaskSchema },
                    { name: Notification.name, schema: NotificationSchema },
                    { name: Export.name, schema: ExportSchema },
                ]),
            ],
            providers: [ExportService, { provide: FilesService, useValue: mockFilesService }],
        }).compile();

        service = module.get(ExportService);
        userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
        taskModel = module.get<Model<TaskDocument>>(getModelToken(Task.name));
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
        exportModel = module.get<Model<ExportDocument>>(getModelToken(Export.name));
    });

    afterAll(() => module.close());

    it('export generates a single part for small datasets and persists Export doc', async () => {
        const ts = Date.now();
        const user = await userModel.create({
            email: `export-small-${ts}@test.com`,
            passwordHash: 'x',
            name: 'Alice',
        });
        await taskModel.create({
            userId: user._id,
            source: 'local',
            sourceId: `task-${ts}`,
            title: 'My Task',
            status: 'open',
            syncedAt: new Date(),
        });

        const result = await service.export(String(user._id));

        expect(result.exportId).toBeTruthy();
        expect(result.files).toHaveLength(1);
        expect(result.files[0].filename).toBe('export-part-1.json');
        expect(result.files[0].contentType).toBe('application/json');

        const doc = await exportModel.findOne({ exportId: result.exportId });
        expect(doc).not.toBeNull();
        expect(doc!.files).toHaveLength(1);
        expect(String(doc!.userId)).toBe(String(user._id));
    });

    it('export includes profile in part 1', async () => {
        const ts = Date.now();
        const user = await userModel.create({
            email: `export-profile-${ts}@test.com`,
            passwordHash: 'x',
            name: 'Bob',
        });

        mockFilesService.save.mockClear();
        await service.export(String(user._id));

        const savedCall = mockFilesService.save.mock.calls.find(
            (c: unknown[]) => (c[0] as { filename: string }).filename === 'export-part-1.json',
        );
        expect(savedCall).toBeDefined();
        const envelope = JSON.parse((savedCall![0] as { data: Buffer }).data.toString('utf-8'));
        expect(envelope.profile.email).toBe(`export-profile-${ts}@test.com`);
        expect(envelope.profile.name).toBe('Bob');
        expect(envelope.version).toBe('1');
        expect(envelope.part).toBe(1);
    });

    it('export includes tasks and notifications in envelope', async () => {
        const ts = Date.now();
        const user = await userModel.create({
            email: `export-data-${ts}@test.com`,
            passwordHash: 'x',
            name: 'Carol',
        });
        await taskModel.create({
            userId: user._id,
            source: 'local',
            sourceId: `t-${ts}`,
            title: 'Task A',
            status: 'done',
            syncedAt: new Date(),
        });
        await notificationModel.create({
            userId: user._id,
            type: 'reminder',
            title: 'Reminder',
            body: 'Body',
        });

        mockFilesService.save.mockClear();
        await service.export(String(user._id));

        const savedCall = mockFilesService.save.mock.calls.find(
            (c: unknown[]) => (c[0] as { prefix: string; filename: string }).filename === 'export-part-1.json',
        );
        const envelope = JSON.parse((savedCall![0] as { data: Buffer }).data.toString('utf-8'));
        expect(envelope.tasks).toHaveLength(1);
        expect(envelope.tasks[0].title).toBe('Task A');
        expect(envelope.tasks[0].status).toBe('done');
        expect(envelope.notifications).toHaveLength(1);
        expect(envelope.notifications[0].title).toBe('Reminder');
    });
});
