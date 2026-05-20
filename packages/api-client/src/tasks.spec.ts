import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { listTasks, createTask, updateTask, deleteTask } from './tasks.js';
import { initClient } from './client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('tasks', () => {
    const mockInstance = {
        post: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
        initClient('http://localhost:3000');
    });

    it('listTasks calls GET /tasks with filter param', async () => {
        mockInstance.get.mockResolvedValueOnce({ data: [] });

        await listTasks('today');

        expect(mockInstance.get).toHaveBeenCalledWith('/tasks', { params: { filter: 'today' } });
    });

    it('createTask posts to /tasks', async () => {
        const task = {
            id: '1',
            title: 'Test',
            completed: false,
            source: 'local',
            sourceId: 'x',
            createdAt: '',
            updatedAt: '',
        };

        mockInstance.post.mockResolvedValueOnce({ data: task });

        const result = await createTask({ title: 'Test', source: 'local' });

        expect(mockInstance.post).toHaveBeenCalledWith('/tasks', { title: 'Test', source: 'local' });
        expect(result).toEqual(task);
    });

    it('updateTask patches /tasks/:id', async () => {
        const task = {
            id: '1',
            title: 'Updated',
            completed: true,
            source: 'local',
            sourceId: 'x',
            createdAt: '',
            updatedAt: '',
        };

        mockInstance.patch.mockResolvedValueOnce({ data: task });

        const result = await updateTask('1', { completed: true });

        expect(mockInstance.patch).toHaveBeenCalledWith('/tasks/1', { completed: true });
        expect(result).toEqual(task);
    });

    it('deleteTask calls DELETE /tasks/:id', async () => {
        mockInstance.delete.mockResolvedValueOnce({});

        await deleteTask('1');

        expect(mockInstance.delete).toHaveBeenCalledWith('/tasks/1');
    });
});
