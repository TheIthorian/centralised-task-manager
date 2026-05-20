import axios, { type AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '@ctm/errors';
import type { OAuthTokens } from '../types.js';
import { GoogleTasksConnector } from './google-tasks.connector.js';

vi.mock('axios');

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

        // GoogleTasksConnector creates two axios instances: http (tasks API) then authHttp (auth API).
        vi.mocked(axios.create)
            .mockReturnValueOnce({ get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete } as unknown as AxiosInstance)
            .mockReturnValueOnce({ post: mockPost } as unknown as AxiosInstance);

        vi.mocked(axios.isAxiosError).mockReturnValue(false);

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
                .mockResolvedValueOnce({ data: { items: [{ id: 'list-1', title: 'My Tasks' }] } })
                .mockResolvedValueOnce({
                    data: {
                        items: [
                            {
                                id: 'gtask-1',
                                title: 'Read a book',
                                notes: 'Fiction',
                                status: 'needsAction',
                                due: '2026-06-15T00:00:00.000Z',
                            },
                        ],
                    },
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
                .mockResolvedValueOnce({ data: { items: [{ id: 'list-1', title: 'My Tasks' }] } })
                .mockResolvedValueOnce({
                    data: {
                        items: [
                            { id: 'gtask-2', title: 'Done', notes: '', status: 'completed' },
                        ],
                    },
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('filters out deleted and hidden tasks', async () => {
            mockGet
                .mockResolvedValueOnce({ data: { items: [{ id: 'list-1', title: 'My Tasks' }] } })
                .mockResolvedValueOnce({
                    data: {
                        items: [
                            { id: 'task-2', title: 'Deleted', status: 'needsAction', deleted: true },
                            { id: 'task-3', title: 'Hidden', status: 'needsAction', hidden: true },
                        ],
                    },
                });

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(0);
        });
    });

    describe('completeTask', () => {
        it('PATCHes status to completed using list:task sourceId', async () => {
            mockPatch.mockResolvedValue({ data: { id: 'gtask-1', title: 'Done', status: 'completed' } });

            await connector.completeTask(tokens, 'list-1:gtask-1');

            expect(mockPatch).toHaveBeenCalledWith(
                '/lists/list-1/tasks/gtask-1',
                { status: 'completed' },
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer google_access_token' }),
                }),
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE using list:task sourceId', async () => {
            mockDelete.mockResolvedValue({ data: undefined });

            await connector.deleteTask(tokens, 'list-1:gtask-1');

            expect(mockDelete).toHaveBeenCalledWith(
                '/lists/list-1/tasks/gtask-1',
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer google_access_token' }),
                }),
            );
        });
    });

    describe('error handling', () => {
        it('wraps AxiosError as ExternalServiceError', async () => {
            vi.mocked(axios.isAxiosError).mockReturnValue(true);
            mockGet.mockRejectedValue({ isAxiosError: true, response: { status: 403, data: 'forbidden' } });

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(ExternalServiceError);
        });

        it('rethrows non-axios errors unchanged', async () => {
            vi.mocked(axios.isAxiosError).mockReturnValue(false);
            mockGet.mockRejectedValue(new TypeError('network fail'));

            await expect(connector.fetchTasks(tokens)).rejects.toThrow(TypeError);
        });
    });
});
