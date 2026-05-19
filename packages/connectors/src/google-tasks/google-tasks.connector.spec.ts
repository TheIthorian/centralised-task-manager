import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    let mockGet: ReturnType<typeof vi.fn>;
    let mockPost: ReturnType<typeof vi.fn>;
    let mockPatch: ReturnType<typeof vi.fn>;
    let mockDelete: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetAllMocks();

        mockGet = vi.fn();
        mockPost = vi.fn();
        mockPatch = vi.fn();
        mockDelete = vi.fn();

        // GoogleTasksConnector creates two HttpClient instances: http (tasks API) then authHttp (auth API).
        vi.mocked(HttpClient)
            .mockImplementationOnce(
                () =>
                    ({
                        get: mockGet,
                        post: mockPost,
                        patch: mockPatch,
                        delete: mockDelete,
                    }) as unknown as HttpClient,
            )
            .mockImplementationOnce(
                () =>
                    ({
                        get: vi.fn(),
                        post: vi.fn(),
                        patch: vi.fn(),
                        delete: vi.fn(),
                    }) as unknown as HttpClient,
            );

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
            mockGet
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
                dueDate: expect.any(Date),
            });
        });

        it('maps completed tasks to status "done"', async () => {
            mockGet
                .mockResolvedValueOnce({ items: [{ id: 'list-1', title: 'My Tasks' }] })
                .mockResolvedValueOnce({
                    items: [
                        { id: 'gtask-2', title: 'Done', notes: '', status: 'completed', due: null },
                    ],
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });
    });

    describe('completeTask', () => {
        it('PATCHes status to completed using list:task sourceId', async () => {
            mockPatch.mockResolvedValue({});

            await connector.completeTask(tokens, 'list-1:gtask-1');

            expect(mockPatch).toHaveBeenCalledWith(
                '/lists/list-1/tasks/gtask-1',
                { status: 'completed' },
                expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE using list:task sourceId', async () => {
            mockDelete.mockResolvedValue(undefined);

            await connector.deleteTask(tokens, 'list-1:gtask-1');

            expect(mockDelete).toHaveBeenCalledWith(
                '/lists/list-1/tasks/gtask-1',
                expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
            );
        });
    });
});
