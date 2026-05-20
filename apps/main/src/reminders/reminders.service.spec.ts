import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemindersService } from './reminders.service.js';
import { Task } from '../tasks/schemas/task.schema.js';

describe('RemindersService', () => {
    let service: RemindersService;
    let mockFind: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const mockSelect = vi.fn().mockResolvedValue([]);
        mockFind = vi.fn().mockReturnValue({ select: mockSelect });

        const module = await Test.createTestingModule({
            providers: [
                RemindersService,
                { provide: getModelToken(Task.name), useValue: { find: mockFind } },
            ],
        }).compile();

        service = module.get(RemindersService);
    });

    it('getSurfacedTaskIds queries with daily on non-Monday', async () => {
        // Ensure today is not Monday for this test
        const tuesday = new Date('2026-05-19'); // Tuesday
        vi.setSystemTime(tuesday);

        const mockSelect = vi.fn().mockResolvedValue([{ _id: 'task-1' }, { _id: 'task-2' }]);
        mockFind.mockReturnValue({ select: mockSelect });

        const ids = await service.getSurfacedTaskIds('507f1f77bcf86cd799439011');
        expect(ids).toEqual(['task-1', 'task-2']);

        const findCall = mockFind.mock.calls[0][0] as Record<string, unknown>;
        const remindEvery = findCall['fuzzyDeadline.remindEvery'] as { $in: string[] };
        expect(remindEvery.$in).toEqual(['daily']);
        expect(remindEvery.$in).not.toContain('weekly');
    });

    it('getSurfacedTaskIds includes weekly tasks on Monday', async () => {
        const monday = new Date('2026-05-18'); // Monday
        vi.setSystemTime(monday);

        const mockSelect = vi.fn().mockResolvedValue([]);
        mockFind.mockReturnValue({ select: mockSelect });

        await service.getSurfacedTaskIds('507f1f77bcf86cd799439011');

        const findCall = mockFind.mock.calls[0][0] as Record<string, unknown>;
        const remindEvery = findCall['fuzzyDeadline.remindEvery'] as { $in: string[] };
        expect(remindEvery.$in).toContain('weekly');
        expect(remindEvery.$in).toContain('daily');
    });

    afterEach(() => {
        vi.useRealTimers();
    });
});
