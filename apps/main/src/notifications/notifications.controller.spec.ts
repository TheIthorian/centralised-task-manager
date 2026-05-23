import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller.js';
import { UsersService } from '../users/users.service.js';
import { Notification } from './schemas/notification.schema.js';
import { DiscordConnection } from './schemas/discord-connection.schema.js';

const userId = new Types.ObjectId().toHexString();
const authReq = { user: { sub: userId, email: 'a@b.com' } };

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let mockNotificationModel: {
        find: ReturnType<typeof vi.fn>;
        findOneAndUpdate: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
    };
    let mockUsersService: {
        getNotificationPreferences: ReturnType<typeof vi.fn>;
        updateNotificationPreferences: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        const mockSort = vi.fn().mockResolvedValue([]);
        const mockLimit = vi.fn().mockReturnValue({ sort: mockSort });
        const mockSkip = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockSelect = vi.fn().mockReturnValue({ skip: mockSkip });
        mockNotificationModel = {
            find: vi.fn().mockReturnValue({ select: mockSelect }),
            findOneAndUpdate: vi.fn().mockResolvedValue({ _id: 'n1', type: 'reminder', read: true }),
            updateMany: vi.fn().mockResolvedValue({ modifiedCount: 3 }),
        };
        mockUsersService = {
            getNotificationPreferences: vi.fn().mockResolvedValue(null),
            updateNotificationPreferences: vi.fn().mockResolvedValue(null),
        };

        const module = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
                {
                    provide: ConfigService,
                    useValue: {
                        get: vi.fn().mockReturnValue('http://localhost:5173'),
                        getOrThrow: vi.fn().mockReturnValue('test-value'),
                    },
                },
                { provide: getModelToken(Notification.name), useValue: mockNotificationModel },
                {
                    provide: getModelToken(DiscordConnection.name),
                    useValue: { findOne: vi.fn().mockResolvedValue(null), deleteOne: vi.fn(), findOneAndUpdate: vi.fn() },
                },
            ],
        }).compile();

        controller = module.get(NotificationsController);
    });

    it('list returns mapped notifications for the user', async () => {
        const docs = [
            { _id: new Types.ObjectId(), type: 'reminder', title: 'T', body: 'B', read: false, createdAt: new Date() },
        ];
        const mockSort2 = vi.fn().mockResolvedValue(docs);
        const mockLimit2 = vi.fn().mockReturnValue({ sort: mockSort2 });
        const mockSkip2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
        const mockSelect2 = vi.fn().mockReturnValue({ skip: mockSkip2 });
        mockNotificationModel.find.mockReturnValue({ select: mockSelect2 });

        const result = await controller.list(authReq as never, 1, 20, false);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ type: 'reminder', read: false });
    });

    it('markRead updates the notification', async () => {
        await controller.markRead(authReq as never, 'n1');
        expect(mockNotificationModel.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ _id: 'n1' }),
            { read: true },
            { new: true },
        );
    });

    it('markAllRead calls updateMany for user unread notifications', async () => {
        const result = await controller.markAllRead(authReq as never);
        expect(mockNotificationModel.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ read: false }),
            { read: true },
        );
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

    it('discordStatus returns connected=false when no connection', async () => {
        const result = await controller.discordStatus(authReq as never);
        expect(result).toEqual({ connected: false });
    });
});
