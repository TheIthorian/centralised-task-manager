import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotionTaskSource } from './notion.source.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            get = vi.fn();
            post = vi.fn();
            patch = vi.fn();
        },
    };
});

const tokens: OAuthTokens = {
    accessToken: 'notion_access_token',
    refreshToken: 'notion_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

const notionHeaders = {
    Authorization: `Bearer ${tokens.accessToken}`,
    'Notion-Version': '2022-06-28',
};

const connectionDetails = { databaseId: 'db-1' };

function makePage(
    overrides: {
        id?: string;
        status?: string | null;
        statusType?: 'status' | 'select';
        priority?: string | null;
        dueDate?: string | null;
        tags?: string[];
        title?: string;
    } = {},
): object {
    const props: Record<string, unknown> = {
        Name: { type: 'title', title: [{ plain_text: overrides.title ?? 'Test Page' }] },
    };

    if (overrides.status !== undefined) {
        const type = overrides.statusType ?? 'status';
        props['Status'] = {
            type,
            [type]: overrides.status ? { id: 'done-id', name: overrides.status, color: 'green' } : null,
        };
    }

    if (overrides.priority !== undefined) {
        props['Priority'] = {
            type: 'select',
            select: overrides.priority ? { id: 'p-id', name: overrides.priority, color: 'red' } : null,
        };
    }

    if (overrides.dueDate !== undefined) {
        props['Due date'] = {
            type: 'date',
            date: overrides.dueDate ? { start: overrides.dueDate, end: null, time_zone: 'UTC' } : null,
        };
    }

    if (overrides.tags !== undefined) {
        props['Tags'] = {
            type: 'multi_select',
            multi_select: overrides.tags.map((name) => ({ id: name, name, color: 'blue' })),
        };
    }

    return { id: overrides.id ?? 'page-1', archived: false, properties: props };
}

describe('NotionTaskSource', () => {
    let source: NotionTaskSource;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        source = new NotionTaskSource({});
        mockHttp = (source as any).http;
    });

    it('name is "notion"', () => {
        expect(source.name).toBe('notion');
    });

    describe('fetchTasks', () => {
        it('throws when connectionDetails.databaseId is absent', async () => {
            await expect(source.fetchTasks(tokens)).rejects.toThrow('databaseId is required');
        });

        it('fetches pages and maps to RemoteTask shape', async () => {
            mockHttp.post.mockResolvedValue({
                results: [makePage({ id: 'p-1', title: 'My Task' })],
                has_more: false,
                next_cursor: null,
            });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(mockHttp.post).toHaveBeenCalledWith('/v1/databases/db-1/query', {}, notionHeaders);
            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'p-1',
                title: 'My Task',
                status: 'open',
                priority: null,
                due: null,
                tags: [],
            });
        });

        it('paginates through multiple pages of results', async () => {
            mockHttp.post
                .mockResolvedValueOnce({ results: [makePage({ id: 'p-1' })], has_more: true, next_cursor: 'cursor-2' })
                .mockResolvedValueOnce({ results: [makePage({ id: 'p-2' })], has_more: false, next_cursor: null });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks).toHaveLength(2);
            expect(mockHttp.post).toHaveBeenCalledTimes(2);
            expect(mockHttp.post).toHaveBeenNthCalledWith(
                2,
                '/v1/databases/db-1/query',
                { start_cursor: 'cursor-2' },
                notionHeaders,
            );
        });

        it('fetches page description from blocks', async () => {
            mockHttp.post.mockResolvedValue({ results: [makePage({ id: 'p-1' })], has_more: false, next_cursor: null });
            mockHttp.get.mockResolvedValue({
                results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello world' }] } }],
                has_more: false,
                next_cursor: null,
            });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks[0].description).toBe('Hello world');
        });

        it('maps status "Done" to done', async () => {
            mockHttp.post.mockResolvedValue({
                results: [makePage({ status: 'Done' })],
                has_more: false,
                next_cursor: null,
            });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks[0].status).toBe('done');
        });

        it('maps status via select type', async () => {
            mockHttp.post.mockResolvedValue({
                results: [makePage({ status: 'Done', statusType: 'select' })],
                has_more: false,
                next_cursor: null,
            });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks[0].status).toBe('done');
        });

        it('maps priority High/Medium/Low to 3/2/1', async () => {
            for (const [name, expected] of [
                ['High', 3],
                ['Medium', 2],
                ['Low', 1],
            ] as const) {
                mockHttp.post.mockResolvedValue({
                    results: [makePage({ priority: name })],
                    has_more: false,
                    next_cursor: null,
                });
                mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });
                const tasks = await source.fetchTasks(tokens, connectionDetails);
                expect(tasks[0].priority).toBe(expected);
            }
        });

        it('maps due date with timezone', async () => {
            mockHttp.post.mockResolvedValue({
                results: [makePage({ dueDate: '2026-07-01' })],
                has_more: false,
                next_cursor: null,
            });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks[0].due?.date).toBeInstanceOf(Date);
            expect(tasks[0].due?.timezone).toBe('UTC');
            expect(tasks[0].due?.recurrence).toBeNull();
        });

        it('maps tags from multi_select', async () => {
            mockHttp.post.mockResolvedValue({
                results: [makePage({ tags: ['work', 'urgent'] })],
                has_more: false,
                next_cursor: null,
            });
            mockHttp.get.mockResolvedValue({ results: [], has_more: false, next_cursor: null });

            const tasks = await source.fetchTasks(tokens, connectionDetails);

            expect(tasks[0].tags).toEqual(['work', 'urgent']);
        });
    });

    describe('createTask', () => {
        it('throws when databaseId is absent', async () => {
            await expect(source.createTask(tokens, { title: 'T' })).rejects.toThrow('databaseId is required');
        });

        it('creates a page with title and returns RemoteTask', async () => {
            const page = makePage({ id: 'new-page', title: 'New Task' });
            mockHttp.post.mockResolvedValue(page);

            const result = await source.createTask(tokens, { title: 'New Task' }, connectionDetails);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/pages',
                expect.objectContaining({
                    parent: { database_id: 'db-1' },
                    properties: expect.objectContaining({
                        Name: { title: [{ text: { content: 'New Task' } }] },
                    }),
                }),
                notionHeaders,
            );
            expect(result.title).toBe('New Task');
        });

        it('includes due date and priority when provided', async () => {
            mockHttp.post.mockResolvedValue(makePage({ title: 'Prio Task', priority: 'High', dueDate: '2026-08-01' }));

            await source.createTask(
                tokens,
                { title: 'Prio Task', due: { date: new Date('2026-08-01') }, priority: 3 },
                connectionDetails,
            );

            const body = mockHttp.post.mock.calls[0][1] as Record<string, unknown>;
            const props = body['properties'] as Record<string, unknown>;
            expect(props['Due date']).toMatchObject({ date: { start: '2026-08-01' } });
            expect(props['Priority']).toMatchObject({ select: { name: 'High' } });
        });
    });

    describe('updateTask', () => {
        it('patches page properties and returns updated RemoteTask', async () => {
            mockHttp.patch.mockResolvedValue(makePage({ id: 'page-1', title: 'Updated' }));

            const result = await source.updateTask(tokens, 'page-1', { title: 'Updated' }, connectionDetails);

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/v1/pages/page-1',
                expect.objectContaining({ properties: expect.objectContaining({ Name: expect.anything() }) }),
                notionHeaders,
            );
            expect(result.title).toBe('Updated');
        });
    });

    describe('completeTask', () => {
        it('sets Status to Done', async () => {
            mockHttp.patch.mockResolvedValue({});

            await source.completeTask(tokens, 'page-1');

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/v1/pages/page-1',
                { properties: { Status: { status: { name: 'Done' } } } },
                notionHeaders,
            );
        });
    });

    describe('deleteTask', () => {
        it('archives the page', async () => {
            mockHttp.patch.mockResolvedValue({});

            await source.deleteTask(tokens, 'page-1');

            expect(mockHttp.patch).toHaveBeenCalledWith('/v1/pages/page-1', { archived: true }, notionHeaders);
        });
    });

    describe('listDatabases', () => {
        it('searches for databases and returns id/name pairs', async () => {
            mockHttp.post.mockResolvedValue({
                results: [
                    { id: 'db-1', title: [{ plain_text: 'Tasks' }] },
                    { id: 'db-2', title: [] },
                ],
                has_more: false,
                next_cursor: null,
            });

            const dbs = await source.listDatabases(tokens);

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/v1/search',
                { filter: { value: 'database', property: 'object' } },
                notionHeaders,
            );
            expect(dbs).toEqual([
                { id: 'db-1', name: 'Tasks' },
                { id: 'db-2', name: 'Untitled' },
            ]);
        });
    });
});
