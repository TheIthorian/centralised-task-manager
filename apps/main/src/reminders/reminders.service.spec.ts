import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemindersService } from './reminders.service.js';
import { Task } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig } from '../connectors/schemas/connector-config.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('RemindersService', () => {
    let service: RemindersService;
    let mockTaskFind: ReturnType<typeof vi.fn>;
    let mockConnectorFind: ReturnType<typeof vi.fn>;
    let mockNotificationsSend: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const mockTaskSelect = vi.fn().mockResolvedValue([]);
        mockTaskFind = vi.fn().mockReturnValue({ select: mockTaskSelect });

        const mockConnectorSelect = vi.fn().mockResolvedValue([]);
        mockConnectorFind = vi.fn().mockReturnValue({ select: mockConnectorSelect });

        mockNotificationsSend = vi.fn().mockResolvedValue(undefined);

        const module = await Test.createTestingModule({
            providers: [
                RemindersService,
                { provide: getModelToken(Task.name), useValue: { find: mockTaskFind } },
                { provide: getModelToken(ConnectorConfig.name), useValue: { find: mockConnectorFind } },
                { provide: NotificationsService, useValue: { send: mockNotificationsSend } },
            ],
        }).compile();

        service = module.get(RemindersService);
    });

    it('getSurfacedTaskIds queries with daily on non-Monday', async () => {
        const tuesday = new Date('2026-05-19');
        vi.setSystemTime(tuesday);

        const mockSelect = vi.fn().mockResolvedValue([{ _id: 'task-1' }, { _id: 'task-2' }]);
        mockTaskFind.mockReturnValue({ select: mockSelect });

        const ids = await service.getSurfacedTaskIds('507f1f77bcf86cd799439011');
        expect(ids).toEqual(['task-1', 'task-2']);

        const findCall = mockTaskFind.mock.calls[0][0] as Record<string, unknown>;
        const remindEvery = findCall['fuzzyDeadline.remindEvery'] as { $in: string[] };
        expect(remindEvery.$in).toEqual(['daily']);
        expect(remindEvery.$in).not.toContain('weekly');
    });

    it('getSurfacedTaskIds includes weekly tasks on Monday', async () => {
        const monday = new Date('2026-05-18');
        vi.setSystemTime(monday);

        const mockSelect = vi.fn().mockResolvedValue([]);
        mockTaskFind.mockReturnValue({ select: mockSelect });

        await service.getSurfacedTaskIds('507f1f77bcf86cd799439011');

        const findCall = mockTaskFind.mock.calls[0][0] as Record<string, unknown>;
        const remindEvery = findCall['fuzzyDeadline.remindEvery'] as { $in: string[] };
        expect(remindEvery.$in).toContain('weekly');
        expect(remindEvery.$in).toContain('daily');
    });

    afterEach(() => {
        vi.useRealTimers();
    });
});
