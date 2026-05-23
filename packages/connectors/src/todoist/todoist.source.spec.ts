import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@ctm/http-client';
import { ExternalServiceError } from '@ctm/errors';
import { TodoistTaskSource } from './todoist.source.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            get = vi.fn();
            post = vi.fn();
            delete = vi.fn();
        },
    };
});

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('TodoistTaskSource', () => {
    let source: TodoistTaskSource;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        source = new TodoistTaskSource({});
        mockHttp = (source as any).http;
    });

    describe('source properties', () => {
        it('name is "todoist"', () => {
            expect(source.name).toBe('todoist');
        });
    });

    describe('fetchTasks', () => {
        it('maps Todoist tasks to RemoteTask shape', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-1',
                        content: 'Buy milk',
                        description: 'From the supermarket',
                        checked: false,
                        priority: 2,
                        due: { date: '2026-06-01', timezone: 'America/New_York', string: '', lang: 'en', is_recurring: false },
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: ['shopping', 'errands'],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(mockHttp.get).toHaveBeenCalledWith('/tasks', {
                Authorization: 'Bearer test_access_token',
            });
            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'task-1',
                title: 'Buy milk',
                description: 'From the supermarket',
                status: 'open',
                priority: 2,
                tags: ['shopping', 'errands'],
                deadline: null,
                duration: null,
                parentSourceId: null,
            });
            expect(tasks[0].due).toMatchObject({ timezone: 'America/New_York', recurrence: null });
            expect(tasks[0].due?.date).toBeInstanceOf(Date);
        });

        it('maps recurring due dates to RRULE recurrence string', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-2',
                        content: 'Daily standup',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: { date: '2026-06-01', timezone: null, string: 'every day', lang: 'en', is_recurring: true },
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].due?.recurrence).toBe('FREQ=DAILY');
        });

        it('maps deadline and duration fields', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'task-3',
                        content: 'Sprint task',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: { date: '2026-06-15', lang: 'en', string: 'Jun 15' },
                        duration: { amount: 90, unit: 'minute' },
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].deadline).toBeInstanceOf(Date);
            expect(tasks[0].duration).toEqual({ amount: 90, unit: 'minute' });
        });

        it('maps parent_id to parentSourceId', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 'child-1',
                        content: 'Child task',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: 'parent-1',
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].parentSourceId).toBe('parent-1');
        });

        it('maps completed tasks to status "done"', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 't2',
                        content: 'Done task',
                        description: '',
                        checked: true,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('sets due to null when no due date', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 't3',
                        content: 'No due',
                        description: '',
                        checked: false,
                        priority: 1,
                        due: null,
                        deadline: null,
                        duration: null,
                        parent_id: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].due).toBeNull();
        });
    });

    describe('createTask', () => {
        it('POSTs task fields to /tasks', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-1',
                content: 'Buy coffee',
                description: '',
                checked: false,
                priority: 2,
                due: null,
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            const task = await source.createTask(tokens, { title: 'Buy coffee', priority: 2 });

            expect(task.sourceId).toBe('new-1');
            expect(task.title).toBe('Buy coffee');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks',
                expect.objectContaining({ content: 'Buy coffee', priority: 2 }),
                { Authorization: 'Bearer test_access_token' },
            );
        });

        it('sends due_date and due_string for recurring tasks', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-2',
                content: 'Stand up',
                description: '',
                checked: false,
                priority: 1,
                due: { date: '2026-06-01', timezone: null, string: 'every day', lang: 'en', is_recurring: true },
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            await source.createTask(tokens, {
                title: 'Stand up',
                due: { date: new Date('2026-06-01'), recurrence: 'FREQ=DAILY' },
            });

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks',
                expect.objectContaining({ due_date: '2026-06-01', due_string: 'every day' }),
                expect.anything(),
            );
        });
    });

    describe('updateTask', () => {
        it('POSTs updated fields to /tasks/:id', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'task-1',
                content: 'Updated',
                description: '',
                checked: false,
                priority: 1,
                due: null,
                deadline: null,
                duration: null,
                parent_id: null,
                labels: [],
            });

            const task = await source.updateTask(tokens, 'task-1', { title: 'Updated' });

            expect(task.title).toBe('Updated');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks/task-1',
                expect.objectContaining({ content: 'Updated' }),
                expect.anything(),
            );
        });
    });

    describe('completeTask', () => {
        it('POSTs to the close endpoint with the task id', async () => {
            mockHttp.post.mockResolvedValue(undefined);

            await source.completeTask(tokens, 'task-1');

            expect(mockHttp.post).toHaveBeenCalledWith('/tasks/task-1/close', {}, {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the task endpoint', async () => {
            mockHttp.delete.mockResolvedValue(undefined);

            await source.deleteTask(tokens, 'task-1');

            expect(mockHttp.delete).toHaveBeenCalledWith('/tasks/task-1', {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('error handling', () => {
        it('propagates ExternalServiceError from HttpClient', async () => {
            mockHttp.get.mockRejectedValue(new ExternalServiceError('https://api.todoist.com/rest/v2/tasks', 'HTTP 429: rate limited'));

            await expect(source.fetchTasks(tokens)).rejects.toThrow(ExternalServiceError);
        });

        it('rethrows non-http errors unchanged', async () => {
            mockHttp.get.mockRejectedValue(new TypeError('network fail'));

            await expect(source.fetchTasks(tokens)).rejects.toThrow(TypeError);
        });
    });
});
