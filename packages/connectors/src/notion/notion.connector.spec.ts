import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@ctm/http-client';
import type { OAuthTokens } from '../types.js';
import { NotionConnector } from './notion.connector.js';

vi.mock('@ctm/http-client', () => ({ HttpClient: vi.fn() }));

const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/notion',
};

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

const connectionDetails = { databaseId: 'db-123' };

describe('NotionConnector', () => {
    let connector: NotionConnector;
    let mockHttp: {
        get: ReturnType<typeof vi.fn>;
        post: ReturnType<typeof vi.fn>;
        patch: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.resetAllMocks();

        mockHttp = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };

        vi.mocked(HttpClient).mockImplementation(function () { return mockHttp as unknown as HttpClient; });

        connector = new NotionConnector(config);
    });

    describe('source', () => {
        it('is "notion"', () => {
            expect(connector.source).toBe('notion');
        });
    });

    describe('connectionDetailsSchema', () => {
        it('declares databaseId as a required remote_select field', () => {
            expect(connector.connectionDetailsSchema).toEqual({
                databaseId: {
                    type: 'remote_select',
                    label: 'Task Database',
                    required: true,
                    endpoint: '/connectors/notion/databases',
                },
            });
        });
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, and state', () => {
            const url = connector.getAuthUrl('user-123');

            expect(url).toContain('client_id=test_client_id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=user-123');
            expect(url).toContain('response_type=code');
            expect(url).toContain('owner=user');
        });
    });

    describe('exchangeCode', () => {
        it('sends Basic auth and returns tokens with 1-hour expiry default', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'access123',
                refresh_token: 'refresh456',
                token_type: 'bearer',
                bot_id: 'bot1',
                workspace_id: 'ws1',
                workspace_name: 'Test Workspace',
            });

            const before = Date.now();
            const result = await connector.exchangeCode('code-abc');
            const after = Date.now();

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/oauth/token',
                { grant_type: 'authorization_code', code: 'code-abc', redirect_uri: config.redirectUri },
                expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }),
            );
            expect(result.accessToken).toBe('access123');
            expect(result.refreshToken).toBe('refresh456');
            expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
            expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 3_600_000);
        });
    });

    describe('refreshToken', () => {
        it('posts grant_type=refresh_token with Basic auth', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
                refresh_token: 'new_refresh',
                token_type: 'bearer',
                bot_id: 'bot1',
                workspace_id: 'ws1',
                workspace_name: 'Test Workspace',
            });

            const result = await connector.refreshToken(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/oauth/token',
                { grant_type: 'refresh_token', refresh_token: tokens.refreshToken },
                expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }),
            );
            expect(result.accessToken).toBe('new_access');
            expect(result.refreshToken).toBe('new_refresh');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            mockHttp.post.mockResolvedValue({
                access_token: 'new_access',
                token_type: 'bearer',
                bot_id: 'bot1',
                workspace_id: 'ws1',
                workspace_name: 'Test Workspace',
            });

            const result = await connector.refreshToken(tokens);

            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });

    describe('fetchTasks', () => {
        it('queries the database from connectionDetails and maps all standard properties', async () => {
            mockHttp.post.mockResolvedValueOnce({
                results: [
                    {
                        id: 'page-1',
                        archived: false,
                        properties: {
                            Name: { type: 'title', title: [{ plain_text: 'Buy milk' }] },
                            Status: { type: 'status', status: { id: 's1', name: 'In Progress', color: 'blue' } },
                            'Due date': { type: 'date', date: { start: '2026-06-01', end: null, time_zone: null } },
                            Priority: { type: 'select', select: { id: 'p1', name: 'High', color: 'red' } },
                            Tags: { type: 'multi_select', multi_select: [{ id: 't1', name: 'work', color: 'gray' }] },
                        },
                    },
                ],
                has_more: false,
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/databases/db-123/query',
                {},
                expect.objectContaining({ Authorization: 'Bearer test_access_token', 'Notion-Version': '2022-06-28' }),
            );
            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'page-1',
                title: 'Buy milk',
                description: null,
                status: 'open',
                priority: 3,
                due: { date: new Date('2026-06-01'), timezone: null, recurrence: null },
                tags: ['work'],
                deadline: null,
                duration: null,
                parentSourceId: null,
            });
        });

        it('maps Status "Done" (case-insensitive) to "done"', async () => {
            mockHttp.post.mockResolvedValueOnce({
                results: [
                    {
                        id: 'page-2',
                        archived: false,
                        properties: {
                            Name: { type: 'title', title: [{ plain_text: 'Done task' }] },
                            Status: { type: 'status', status: { id: 's2', name: 'done', color: 'green' } },
                        },
                    },
                ],
                has_more: false,
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(tasks[0]!.status).toBe('done');
        });

        it('returns null priority when Priority property is missing', async () => {
            mockHttp.post.mockResolvedValueOnce({
                results: [
                    {
                        id: 'page-3',
                        archived: false,
                        properties: {
                            Name: { type: 'title', title: [{ plain_text: 'No priority' }] },
                        },
                    },
                ],
                has_more: false,
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(tasks[0]!.priority).toBeNull();
        });

        it('returns empty tags when Tags property is missing', async () => {
            mockHttp.post.mockResolvedValueOnce({
                results: [
                    {
                        id: 'page-4',
                        archived: false,
                        properties: {
                            Name: { type: 'title', title: [{ plain_text: 'No tags' }] },
                        },
                    },
                ],
                has_more: false,
                next_cursor: null,
            });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(tasks[0]!.tags).toEqual([]);
        });

        it('paginates — fetches all pages when has_more is true', async () => {
            mockHttp.post
                .mockResolvedValueOnce({
                    results: [
                        {
                            id: 'page-a',
                            archived: false,
                            properties: { Name: { type: 'title', title: [{ plain_text: 'Task A' }] } },
                        },
                    ],
                    has_more: true,
                    next_cursor: 'cursor-1',
                })
                .mockResolvedValueOnce({
                    results: [
                        {
                            id: 'page-b',
                            archived: false,
                            properties: { Name: { type: 'title', title: [{ plain_text: 'Task B' }] } },
                        },
                    ],
                    has_more: false,
                    next_cursor: null,
                });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(tasks).toHaveLength(2);
            expect(mockHttp.post).toHaveBeenCalledTimes(2);
            expect(mockHttp.post).toHaveBeenNthCalledWith(
                2,
                '/v1/databases/db-123/query',
                { start_cursor: 'cursor-1' },
                expect.anything(),
            );
        });

        it('maps Medium priority to 2 and Low priority to 1', async () => {
            mockHttp.post
                .mockResolvedValueOnce({
                    results: [
                        {
                            id: 'page-med',
                            archived: false,
                            properties: {
                                Name: { type: 'title', title: [{ plain_text: 'Medium task' }] },
                                Priority: { type: 'select', select: { id: 'p2', name: 'Medium', color: 'yellow' } },
                            },
                        },
                        {
                            id: 'page-low',
                            archived: false,
                            properties: {
                                Name: { type: 'title', title: [{ plain_text: 'Low task' }] },
                                Priority: { type: 'select', select: { id: 'p3', name: 'Low', color: 'gray' } },
                            },
                        },
                    ],
                    has_more: false,
                    next_cursor: null,
                });

            const tasks = await connector.fetchTasks(tokens, connectionDetails);

            expect(tasks[0]!.priority).toBe(2);
            expect(tasks[1]!.priority).toBe(1);
        });
    });

    describe('createTask', () => {
        it('posts to /v1/pages with parent database_id from connectionDetails', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'new-page-id',
                archived: false,
                properties: {
                    Name: { type: 'title', title: [{ plain_text: 'New task' }] },
                    Status: { type: 'status', status: { id: 's1', name: 'Not started', color: 'gray' } },
                },
            });

            const task = await connector.createTask(
                tokens,
                { title: 'New task', priority: 3 },
                connectionDetails,
            );

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/pages',
                expect.objectContaining({
                    parent: { database_id: 'db-123' },
                    properties: expect.objectContaining({
                        Name: { title: [{ text: { content: 'New task' } }] },
                    }),
                }),
                expect.objectContaining({ Authorization: 'Bearer test_access_token' }),
            );
            expect(task.sourceId).toBe('new-page-id');
            expect(task.title).toBe('New task');
        });

        it('includes due date property when task.due is provided', async () => {
            mockHttp.post.mockResolvedValue({
                id: 'page-with-due',
                archived: false,
                properties: {
                    Name: { type: 'title', title: [{ plain_text: 'Task with due' }] },
                },
            });

            await connector.createTask(
                tokens,
                { title: 'Task with due', due: { date: new Date('2026-07-01') } },
                connectionDetails,
            );

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/pages',
                expect.objectContaining({
                    properties: expect.objectContaining({
                        'Due date': { date: { start: '2026-07-01' } },
                    }),
                }),
                expect.anything(),
            );
        });
    });

    describe('updateTask', () => {
        it('patches /v1/pages/:pageId with updated properties', async () => {
            mockHttp.patch.mockResolvedValue({
                id: 'page-1',
                archived: false,
                properties: {
                    Name: { type: 'title', title: [{ plain_text: 'Updated title' }] },
                },
            });

            const task = await connector.updateTask(
                tokens,
                'page-1',
                { title: 'Updated title' },
                connectionDetails,
            );

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/v1/pages/page-1',
                expect.objectContaining({
                    properties: expect.objectContaining({
                        Name: { title: [{ text: { content: 'Updated title' } }] },
                    }),
                }),
                expect.objectContaining({ Authorization: 'Bearer test_access_token' }),
            );
            expect(task.title).toBe('Updated title');
        });
    });

    describe('completeTask', () => {
        it('patches Status to "Done"', async () => {
            mockHttp.patch.mockResolvedValue({
                id: 'page-1',
                archived: false,
                properties: {
                    Name: { type: 'title', title: [{ plain_text: 'Done task' }] },
                    Status: { type: 'status', status: { id: 's1', name: 'Done', color: 'green' } },
                },
            });

            await connector.completeTask(tokens, 'page-1', connectionDetails);

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/v1/pages/page-1',
                { properties: { Status: { status: { name: 'Done' } } } },
                expect.objectContaining({ Authorization: 'Bearer test_access_token' }),
            );
        });
    });

    describe('deleteTask', () => {
        it('archives the page via PATCH', async () => {
            mockHttp.patch.mockResolvedValue({
                id: 'page-1',
                archived: true,
                properties: {},
            });

            await connector.deleteTask(tokens, 'page-1', connectionDetails);

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/v1/pages/page-1',
                { archived: true },
                expect.objectContaining({ Authorization: 'Bearer test_access_token' }),
            );
        });
    });

    describe('listDatabases', () => {
        it('searches for databases and returns id+name pairs', async () => {
            mockHttp.post.mockResolvedValue({
                results: [
                    { id: 'db-1', title: [{ plain_text: 'Tasks' }] },
                    { id: 'db-2', title: [{ plain_text: 'Projects' }] },
                ],
                has_more: false,
                next_cursor: null,
            });

            const databases = await connector.listDatabases(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/search',
                { filter: { value: 'database', property: 'object' } },
                expect.objectContaining({ Authorization: 'Bearer test_access_token', 'Notion-Version': '2022-06-28' }),
            );
            expect(databases).toEqual([
                { id: 'db-1', name: 'Tasks' },
                { id: 'db-2', name: 'Projects' },
            ]);
        });
    });
});
