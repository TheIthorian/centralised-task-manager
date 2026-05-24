import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { UsersService } from '../users/users.service.js';
import { Notification, NotificationSchema, type NotificationDocument } from './schemas/notification.schema.js';

const userId = new Types.ObjectId().toHexString();
const authReq = { user: { sub: userId, email: 'a@b.com' } };

describe('NotificationsController', () => {
    let module: TestingModule;
    let controller: NotificationsController;
    let notificationModel: Model<NotificationDocument>;
    let mockUsersService: {
        getNotificationPreferences: ReturnType<typeof vi.fn>;
        updateNotificationPreferences: ReturnType<typeof vi.fn>;
    };

    beforeAll(async () => {
        mockUsersService = {
            getNotificationPreferences: vi.fn().mockResolvedValue(null),
            updateNotificationPreferences: vi.fn().mockResolvedValue(null),
        };

        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
            ],
            controllers: [NotificationsController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
                { provide: NotificationsService, useValue: { testChannel: vi.fn(), send: vi.fn() } },
            ],
        }).compile();

        controller = module.get(NotificationsController);
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('list returns mapped notifications for the user', async () => {
        const uid = new Types.ObjectId(userId);
        await notificationModel.create({
            userId: uid,
            type: 'reminder',
            title: 'T',
            body: 'B',
            read: false,
        });

        const result = await controller.list(authReq as never, 1, 20, false);

        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result[0]).toMatchObject({ type: 'reminder', read: false });
    });

    it('markRead updates the notification', async () => {
        const doc = await notificationModel.create({
            userId: new Types.ObjectId(userId),
            type: 'reminder',
            title: 'Mark me',
            body: 'B',
            read: false,
        });

        await controller.markRead(authReq as never, String(doc._id));

        const updated = await notificationModel.findById(doc._id);

        expect(updated?.read).toBe(true);
    });

    it('markAllRead sets all unread notifications as read', async () => {
        const otherUserId = new Types.ObjectId().toHexString();
        const otherReq = { user: { sub: otherUserId, email: 'other@b.com' } };
        const uid = new Types.ObjectId(otherUserId);
        await notificationModel.create([
            { userId: uid, type: 'reminder', title: 'T1', body: 'B', read: false },
            { userId: uid, type: 'daily_summary', title: 'T2', body: 'B', read: false },
        ]);

        const result = await controller.markAllRead(otherReq as never);

        expect(result.updated).toBeGreaterThanOrEqual(2);
        const remaining = await notificationModel.find({ userId: uid, read: false });
        expect(remaining).toHaveLength(0);
    });

    it('getPreferences delegates to UsersService', async () => {
        mockUsersService.getNotificationPreferences.mockResolvedValue({ connectorReconnect: { inApp: true } });
        const result = await controller.getPreferences(authReq as never);

        expect(result).toMatchObject({ connectorReconnect: { inApp: true } });
    });

    it('updatePreferences delegates to UsersService', async () => {
        mockUsersService.updateNotificationPreferences.mockResolvedValue({ dailySummary: { discord: true } });
        const result = await controller.updatePreferences(authReq as never, { dailySummary: { discord: true } });

        expect(result).toMatchObject({ dailySummary: { discord: true } });
    });
});
