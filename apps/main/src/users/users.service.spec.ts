import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User } from './schemas/user.schema.js';
import { ConnectorConfig } from '../connectors/schemas/connector-config.schema.js';
import { Task } from '../tasks/schemas/task.schema.js';

describe('UsersService — notification preferences', () => {
    let service: UsersService;
    let mockFindById: ReturnType<typeof vi.fn>;
    let mockFindByIdAndUpdate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockFindById = vi.fn();
        mockFindByIdAndUpdate = vi.fn();

        const module = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: getModelToken(User.name),
                    useValue: {
                        findById: mockFindById,
                        findByIdAndUpdate: mockFindByIdAndUpdate,
                        findOne: vi.fn(),
                        findByIdAndDelete: vi.fn(),
                        create: vi.fn(),
                    },
                },
                { provide: getModelToken(ConnectorConfig.name), useValue: { deleteMany: vi.fn() } },
                { provide: getModelToken(Task.name), useValue: { deleteMany: vi.fn() } },
            ],
        }).compile();

        service = module.get(UsersService);
    });

    it('getNotificationPreferences returns prefs for existing user', async () => {
        const prefs = { connectorReconnect: { inApp: true, discord: false, email: false } };
        const mockSelect = vi.fn().mockResolvedValue({ notificationPreferences: prefs });
        mockFindById.mockReturnValue({ select: mockSelect });

        const result = await service.getNotificationPreferences('u1');
        expect(result).toEqual(prefs);
    });

    it('getNotificationPreferences returns null when user not found', async () => {
        const mockSelect = vi.fn().mockResolvedValue(null);
        mockFindById.mockReturnValue({ select: mockSelect });

        const result = await service.getNotificationPreferences('missing');
        expect(result).toBeNull();
    });

    it('updateNotificationPreferences patches specified trigger channels via $set', async () => {
        const existing = { notificationPreferences: { dailySummary: { inApp: true, discord: false, email: false } } };
        const mockSelectForFind = vi.fn().mockResolvedValue(existing);
        mockFindById.mockReturnValue({ select: mockSelectForFind });

        const updated = { notificationPreferences: { dailySummary: { inApp: false, discord: true, email: false } } };
        const mockSelectForUpdate = vi.fn().mockResolvedValue(updated);
        mockFindByIdAndUpdate.mockReturnValue({ select: mockSelectForUpdate });

        const result = await service.updateNotificationPreferences({
            userId: 'u1',
            prefs: { dailySummary: { discord: true, inApp: false } },
        });
        expect(result).toEqual(updated.notificationPreferences);
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
            'u1',
            expect.objectContaining({ $set: expect.any(Object) }),
            { new: true },
        );
    });

    it('updateNotificationPreferences throws NotFoundException when user not found', async () => {
        const mockSelectForFind = vi.fn().mockResolvedValue(null);
        mockFindById.mockReturnValue({ select: mockSelectForFind });

        await expect(
            service.updateNotificationPreferences({ userId: 'missing', prefs: {} }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
