import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '@ctm/errors';
import { HttpClient } from '@ctm/http-client';

import type { OAuthTokens } from '../types.js';
import { TodoistConnector } from './todoist.connector.js';

vi.mock('@ctm/http-client', () => ({ HttpClient: vi.fn() }));

const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/todoist',
};

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('TodoistConnector', () => {
    let connector: TodoistConnector;
    let mockHttp: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    let mockAuthHttp: { post: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.resetAllMocks();

        mockHttp = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
        mockAuthHttp = { post: vi.fn() };

        // TodoistConnector creates two HttpClients: http (tasks API) then authHttp (auth API).
        vi.mocked(HttpClient)
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockHttp as unknown as HttpClient; })
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockAuthHttp as unknown as HttpClient; });

        connector = new TodoistConnector(config);
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-123');

            expect(url).toContain('client_id=test_client_id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=user-123');
            expect(url).toContain('scope=task%3Aadd%2Cdata%3Aread%2Cdata%3Adelete');
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
                        is_completed: false,
                        priority: 2,
                        due: { date: '2026-06-01' },
                        labels: ['shopping', 'errands'],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'task-1',
                title: 'Buy milk',
                description: 'From the supermarket',
                status: 'open',
                priority: 2,
                tags: ['shopping', 'errands'],
            });
            expect(tasks[0].dueDate).toBeInstanceOf(Date);
        });

        it('maps completed tasks to status "done"', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    {
                        id: 't2',
                        content: 'Done task',
                        description: '',
                        is_completed: true,
                        priority: 1,
                        due: null,
                        labels: [],
                    },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('sets dueDate to null when no due date', async () => {
            mockHttp.get.mockResolvedValue({
                results: [
                    { id: 't3', content: 'No due', description: '', is_completed: false, priority: 1, due: null, labels: [] },
                ],
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].dueDate).toBeNull();
        });
    });

    describe('createTask', () => {
        it('POSTs task fields to /tasks', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-1',
                content: 'Buy coffee',
                description: '',
                is_completed: false,
                priority: 2,
                due: null,
                labels: [],
            });

            const task = await connector.createTask(tokens, { title: 'Buy coffee', priority: 2 });

            expect(task.sourceId).toBe('new-1');
            expect(task.title).toBe('Buy coffee');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/tasks',
                expect.objectContaining({ content: 'Buy coffee', priority: 2 }),
                { Authorization: 'Bearer test_access_token' },
            );
        });
    });

    describe('updateTask', () => {
        it('POSTs updated fields to /tasks/:id', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'task-1',
                content: 'Updated',
                description: '',
                is_completed: false,
                priority: 1,
                due: null,
                labels: [],
            });

            const task = await connector.updateTask(tokens, 'task-1', { title: 'Updated' });

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

            await connector.completeTask(tokens, 'task-1');

            expect(mockHttp.post).toHaveBeenCalledWith('/tasks/task-1/close', {}, {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the task endpoint', async () => {
            mockHttp.delete.mockResolvedValue(undefined);

            await connector.deleteTask(tokens, 'task-1');

            expect(mockHttp.delete).toHaveBeenCalledWith('/tasks/task-1', {
                Authorization: 'Bearer test_access_token',
            });
        });
    });

    describe('error handling', () => {
        it('propagates ExternalServiceError from HttpClient', async () => {
            mockHttp.get.mockRejectedValue(new ExternalServiceError('https://api.todoist.com/rest/v2/tasks', 'HTTP 429: rate limited'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(ExternalServiceError);
        });

        it('rethrows non-http errors unchanged', async () => {
            mockHttp.get.mockRejectedValue(new TypeError('network fail'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(TypeError);
        });
    });
});
