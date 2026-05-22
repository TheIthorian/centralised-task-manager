import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '@ctm/errors';
import { HttpClient } from '@ctm/http-client';

import type { OAuthTokens } from '../types.js';
import { GoogleTasksConnector } from './google-tasks.connector.js';

vi.mock('@ctm/http-client', () => ({ HttpClient: vi.fn() }));

const config = {
    clientId: 'google_client_id',
    clientSecret: 'google_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/google_tasks',
};

const tokens: OAuthTokens = {
    accessToken: 'google_access_token',
    refreshToken: 'google_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('GoogleTasksConnector', () => {
    let connector: GoogleTasksConnector;
    let mockHttp: {
        get: ReturnType<typeof vi.fn>;
        post: ReturnType<typeof vi.fn>;
        patch: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    let mockAuthHttp: { post: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.resetAllMocks();

        mockHttp = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
        mockAuthHttp = { post: vi.fn() };

        // GoogleTasksConnector creates two HttpClients: http (tasks API) then authHttp (auth API).
        vi.mocked(HttpClient)
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockHttp as unknown as HttpClient; })
            // eslint-disable-next-line prefer-arrow-callback
            .mockImplementationOnce(function () { return mockAuthHttp as unknown as HttpClient; });

        connector = new GoogleTasksConnector(config);
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state but not PKCE params', () => {
            const url = connector.getAuthUrl('user-456');

            expect(url).toContain('client_id=google_client_id');
            expect(url).toContain('state=user-456');
            expect(url).toContain('scope=');
            expect(url).toContain('tasks');
            expect(url).not.toContain('code_challenge');
        });
    });

    describe('fetchTasks', () => {
        it('fetches task lists then tasks, maps to RemoteTask', async () => {
            mockHttp.get
                .mockResolvedValueOnce({ items: [{ id: 'list-1', title: 'My Tasks' }] })
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: 'gtask-1',
                            title: 'Read a book',
                            notes: 'Fiction',
                            status: 'needsAction',
                            due: '2026-06-15T00:00:00.000Z',
                        },
                    ],
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'list-1:gtask-1',
                title: 'Read a book',
                description: 'Fiction',
                status: 'open',
                due: expect.objectContaining({ date: expect.any(Date) }),
            });
        });

        it('maps completed tasks to status "done"', async () => {
            mockHttp.get
                .mockResolvedValueOnce({ items: [{ id: 'list-1', title: 'My Tasks' }] })
                .mockResolvedValueOnce({
                    items: [{ id: 'gtask-2', title: 'Done', notes: '', status: 'completed' }],
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('filters out deleted and hidden tasks', async () => {
            mockHttp.get
                .mockResolvedValueOnce({ items: [{ id: 'list-1', title: 'My Tasks' }] })
                .mockResolvedValueOnce({
                    items: [
                        { id: 'task-2', title: 'Deleted', status: 'needsAction', deleted: true },
                        { id: 'task-3', title: 'Hidden', status: 'needsAction', hidden: true },
                    ],
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(0);
        });
    });

    describe('createTask', () => {
        it('GETs lists then POSTs task to first list', async () => {
            mockHttp.get.mockResolvedValue({ items: [{ id: 'list-1', title: 'My Tasks' }] });
            mockHttp.post.mockResolvedValue({ id: 'task-new', title: 'New task', status: 'needsAction' });

            const task = await connector.createTask(tokens, { title: 'New task' });

            expect(task.sourceId).toBe('list-1:task-new');
            expect(task.title).toBe('New task');
            expect(mockHttp.post).toHaveBeenCalledWith(
                '/lists/list-1/tasks',
                expect.objectContaining({ title: 'New task' }),
                { Authorization: 'Bearer google_access_token' },
            );
        });
    });

    describe('updateTask', () => {
        it('PATCHes task fields', async () => {
            mockHttp.patch.mockResolvedValue({ id: 'task-1', title: 'Updated', status: 'needsAction' });

            const task = await connector.updateTask(tokens, 'list-1:task-1', { title: 'Updated' });

            expect(task.title).toBe('Updated');
            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/lists/list-1/tasks/task-1',
                expect.objectContaining({ title: 'Updated' }),
                expect.anything(),
            );
        });
    });

    describe('completeTask', () => {
        it('PATCHes status to completed using list:task sourceId', async () => {
            mockHttp.patch.mockResolvedValue({ id: 'gtask-1', title: 'Done', status: 'completed' });

            await connector.completeTask(tokens, 'list-1:gtask-1');

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/lists/list-1/tasks/gtask-1',
                { status: 'completed' },
                { Authorization: 'Bearer google_access_token' },
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE using list:task sourceId', async () => {
            mockHttp.delete.mockResolvedValue(undefined);

            await connector.deleteTask(tokens, 'list-1:gtask-1');

            expect(mockHttp.delete).toHaveBeenCalledWith('/lists/list-1/tasks/gtask-1', {
                Authorization: 'Bearer google_access_token',
            });
        });
    });

    describe('error handling', () => {
        it('propagates ExternalServiceError from HttpClient', async () => {
            mockHttp.get.mockRejectedValue(
                new ExternalServiceError('https://tasks.googleapis.com/tasks/v1/users/@me/lists', 'HTTP 403: forbidden'),
            );

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(ExternalServiceError);
        });

        it('rethrows non-http errors unchanged', async () => {
            mockHttp.get.mockRejectedValue(new TypeError('network fail'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(TypeError);
        });
    });
});
