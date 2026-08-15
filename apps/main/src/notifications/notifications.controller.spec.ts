import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { UsersService } from '../users/users.service.js';
import { Notification, NotificationSchema, type NotificationDocument } from '@ctm/db';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';

const userId = new Types.ObjectId().toHexString();
const authReq = { user: { sub: userId, email: 'a@b.com' } };

describe('NotificationsController', () => {
    let module: TestingModule;
    let controller: NotificationsController;
    let notificationModel: Model<NotificationDocument>;

    let mockNotificationsService: {
        testChannel: ReturnType<typeof vi.fn>;
        send: ReturnType<typeof vi.fn>;
        list: ReturnType<typeof vi.fn>;
        markRead: ReturnType<typeof vi.fn>;
        markAllRead: ReturnType<typeof vi.fn>;
    };

    let mockUsersService: {
        getNotificationPreferences: ReturnType<typeof vi.fn>;
        updateNotificationPreferences: ReturnType<typeof vi.fn>;
    };

    beforeAll(async () => {
        mockNotificationsService = {
            testChannel: vi.fn().mockResolvedValue({ sent: true }),
            send: vi.fn().mockResolvedValue(undefined),
            list: vi.fn().mockResolvedValue([]),
            markRead: vi.fn().mockResolvedValue({ id: 'x', read: true }),
            markAllRead: vi.fn().mockResolvedValue({ updated: 0 }),
        };

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
                { provide: NotificationsService, useValue: mockNotificationsService },
            ],
        }).compile();

        controller = module.get(NotificationsController);
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('list delegates to NotificationsService', async () => {
        const fakeNotification = {
            id: new Types.ObjectId().toHexString(),
            type: 'reminder',
            data: { type: 'reminder' },
            title: 'T',
            body: 'B',
            read: false,
            createdAt: new Date().toISOString(),
        };

        mockNotificationsService.list.mockResolvedValueOnce([fakeNotification]);

        const query = Object.assign(new ListNotificationsQueryDto(), { page: 1, limit: 20, unreadOnly: false });
        const result = await controller.list(authReq as never, query);

        expect(mockNotificationsService.list).toHaveBeenCalledWith({
            userId,
            page: 1,
            limit: 20,
            unreadOnly: false,
        });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ type: 'reminder', read: false });
    });

    it('markRead delegates to NotificationsService', async () => {
        const docId = new Types.ObjectId().toHexString();
        mockNotificationsService.markRead.mockResolvedValueOnce({ id: docId, read: true });

        const result = await controller.markRead(authReq as never, docId);

        expect(mockNotificationsService.markRead).toHaveBeenCalledWith({ userId, id: docId });
        expect(result).toMatchObject({ id: docId, read: true });
    });

    it('markAllRead delegates to NotificationsService', async () => {
        mockNotificationsService.markAllRead.mockResolvedValueOnce({ updated: 3 });

        const result = await controller.markAllRead(authReq as never);

        expect(mockNotificationsService.markAllRead).toHaveBeenCalledWith({ userId });
        expect(result).toMatchObject({ updated: 3 });
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

    // Verify the model is accessible (keeps the MongooseModule import meaningful)
    it('notification model is available in test module', () => {
        expect(notificationModel).toBeDefined();
    });
});
