import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleTasksConnector } from './google-tasks.connector.js';
import type { OAuthTokens } from '../types.js';

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

    beforeEach(() => {
        connector = new GoogleTasksConnector(config);
        vi.restoreAllMocks();
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-456');
            expect(url).toContain('client_id=google_client_id');
            expect(url).toContain('state=user-456');
            expect(url).toContain('scope=');
            expect(url).toContain('tasks');
            expect(url).toContain('code_challenge');
        });
    });

    describe('fetchTasks', () => {
        it('fetches task lists then tasks, maps to RemoteTask', async () => {
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ items: [{ id: 'list-1', title: 'My Tasks' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [{
                            id: 'gtask-1',
                            title: 'Read a book',
                            notes: 'Fiction',
                            status: 'needsAction',
                            due: '2026-06-15T00:00:00.000Z',
                        }],
                    }),
                }),
            );

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
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ items: [{ id: 'list-1', title: 'My Tasks' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [{ id: 'gtask-2', title: 'Done', notes: '', status: 'completed', due: null }],
                    }),
                }),
            );

            const tasks = await connector.fetchTasks(tokens);
            expect(tasks[0].status).toBe('done');
        });
    });

    describe('completeTask', () => {
        it('PATCHes status to completed using list:task sourceId', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));
            await connector.completeTask(tokens, 'list-1:gtask-1');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/lists/list-1/tasks/gtask-1'),
                expect.objectContaining({ method: 'PATCH' }),
            );
        });
    });
});
