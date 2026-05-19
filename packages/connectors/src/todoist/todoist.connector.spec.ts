import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    let mockGet: ReturnType<typeof vi.fn>;
    let mockPost: ReturnType<typeof vi.fn>;
    let mockDelete: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetAllMocks();

        mockGet = vi.fn();
        mockPost = vi.fn();
        mockDelete = vi.fn();

        // TodoistConnector creates two HttpClient instances: http (tasks API) then authHttp (auth API).
        vi.mocked(HttpClient)
            .mockImplementationOnce(
                () =>
                    ({
                        get: mockGet,
                        post: mockPost,
                        patch: vi.fn(),
                        delete: mockDelete,
                    }) as unknown as HttpClient,
            )
            .mockImplementationOnce(
                () =>
                    ({
                        get: vi.fn(),
                        post: mockPost,
                        patch: vi.fn(),
                        delete: vi.fn(),
                    }) as unknown as HttpClient,
            );

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
            mockGet.mockResolvedValue([
                {
                    id: 'task-1',
                    content: 'Buy milk',
                    description: 'From the supermarket',
                    is_completed: false,
                    priority: 2,
                    due: { date: '2026-06-01' },
                    labels: ['shopping', 'errands'],
                },
            ]);

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
            mockGet.mockResolvedValue([
                {
                    id: 't2',
                    content: 'Done task',
                    description: '',
                    is_completed: true,
                    priority: 1,
                    due: null,
                    labels: [],
                },
            ]);

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('sets dueDate to null when no due date', async () => {
            mockGet.mockResolvedValue([
                {
                    id: 't3',
                    content: 'No due',
                    description: '',
                    is_completed: false,
                    priority: 1,
                    due: null,
                    labels: [],
                },
            ]);

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].dueDate).toBeNull();
        });
    });

    describe('completeTask', () => {
        it('POSTs to the close endpoint with the task id', async () => {
            mockPost.mockResolvedValue(undefined);

            await connector.completeTask(tokens, 'task-1');

            expect(mockPost).toHaveBeenCalledWith(
                '/tasks/task-1/close',
                {},
                expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the task endpoint', async () => {
            mockDelete.mockResolvedValue(undefined);

            await connector.deleteTask(tokens, 'task-1');

            expect(mockDelete).toHaveBeenCalledWith(
                '/tasks/task-1',
                expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
            );
        });
    });
});
