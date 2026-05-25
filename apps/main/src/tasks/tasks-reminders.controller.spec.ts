import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import type { ReminderDto, OkDto } from '@ctm/api-client';

const mockService = {
    list: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    setFuzzyDeadline: vi.fn(),
    removeFuzzyDeadline: vi.fn(),
    remove: vi.fn(),
    addReminder: vi.fn(),
    removeReminder: vi.fn(),
};

const req = { user: { sub: 'user-1' } };

describe('TasksController – reminder endpoints', () => {
    let controller: TasksController;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TasksController],
            providers: [{ provide: TasksService, useValue: mockService }],
        })
            .overrideGuard(CombinedAuthGuard)
            .useValue({ canActivate: (_ctx: ExecutionContext) => true })
            .compile();

        controller = module.get(TasksController);
    });

    it('POST /tasks/:id/reminders delegates to service and returns ReminderDto', async () => {
        const dto: ReminderDto = { remindAt: '2026-06-01T14:00:00.000Z', firedAt: null };
        mockService.addReminder.mockResolvedValue(dto);

        const result = await controller.addReminder(req as never, 'task-1', { remindAt: '2026-06-01T14:00:00.000Z' });

        expect(mockService.addReminder).toHaveBeenCalledWith({
            taskId: 'task-1',
            userId: 'user-1',
            dto: { remindAt: '2026-06-01T14:00:00.000Z' },
        });
        expect(result).toEqual(dto);
    });

    it('DELETE /tasks/:id/reminders/:index delegates to service and returns ok', async () => {
        mockService.removeReminder.mockResolvedValue(undefined);

        const result: OkDto = await controller.removeReminder(req as never, 'task-1', '0');

        expect(mockService.removeReminder).toHaveBeenCalledWith({
            taskId: 'task-1',
            userId: 'user-1',
            index: 0,
        });
        expect(result).toEqual({ ok: true });
    });
});
