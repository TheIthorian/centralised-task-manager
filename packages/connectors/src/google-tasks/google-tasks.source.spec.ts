import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleTasksTaskSource } from './google-tasks.source.js';
import type { OAuthTokens } from '../types.js';

vi.mock('@ctm/http-client', () => {
    return {
        HttpClient: class MockHttpClient {
            get = vi.fn();
            post = vi.fn();
            patch = vi.fn();
            delete = vi.fn();
        },
    };
});

const tokens: OAuthTokens = {
    accessToken: 'google_access_token',
    refreshToken: 'google_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };

const listA = { id: 'list-a', title: 'My Tasks' };
const listB = { id: 'list-b', title: 'Work' };

function makeGoogleTask(
    overrides: Partial<{
        id: string;
        title: string;
        notes: string;
        status: 'needsAction' | 'completed';
        due: string;
        deleted: boolean;
        hidden: boolean;
    }> = {},
): object {
    return {
        kind: 'tasks#task',
        id: 'task-1',
        etag: 'etag',
        title: 'Test Task',
        updated: new Date().toISOString(),
        selfLink: '',
        position: '0',
        status: 'needsAction',
        ...overrides,
    };
}

describe('GoogleTasksTaskSource', () => {
    let source: GoogleTasksTaskSource;
    let mockHttp: any;

    beforeEach(() => {
        vi.clearAllMocks();
        source = new GoogleTasksTaskSource({});
        mockHttp = (source as any).http;
    });

    it('name is "google_tasks"', () => {
        expect(source.name).toBe('google_tasks');
    });

    describe('fetchTasks', () => {
        it('fetches tasks across all lists and maps to RemoteTask shape', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA] });
                if (path.includes('list-a'))
                    return Promise.resolve({
                        items: [makeGoogleTask({ id: 't1', title: 'Buy milk', notes: 'Full fat' })],
                    });
                return Promise.resolve({ items: [] });
            });

            const tasks = await source.fetchTasks(tokens);

            expect(mockHttp.get).toHaveBeenCalledWith('/users/@me/lists', authHeader);
            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'list-a:t1',
                title: 'Buy milk',
                description: 'Full fat',
                status: 'open',
                priority: null,
                due: null,
                deadline: null,
                duration: null,
                parentSourceId: null,
                tags: [],
            });
        });

        it('fetches tasks from multiple lists concurrently', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA, listB] });
                if (path.includes('list-a'))
                    return Promise.resolve({ items: [makeGoogleTask({ id: 'ta', title: 'A task' })] });
                if (path.includes('list-b'))
                    return Promise.resolve({ items: [makeGoogleTask({ id: 'tb', title: 'B task' })] });
                return Promise.resolve({ items: [] });
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks).toHaveLength(2);
            expect(tasks.map((t) => t.sourceId).sort()).toEqual(['list-a:ta', 'list-b:tb']);
        });

        it('maps due date to DueDate shape', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA] });
                return Promise.resolve({ items: [makeGoogleTask({ due: '2026-06-15T00:00:00.000Z' })] });
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].due).toMatchObject({ timezone: null, recurrence: null });
            expect(tasks[0].due?.date).toBeInstanceOf(Date);
        });

        it('maps completed tasks to status "done"', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA] });
                return Promise.resolve({ items: [makeGoogleTask({ status: 'completed' })] });
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks[0].status).toBe('done');
        });

        it('excludes deleted and hidden tasks', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA] });
                return Promise.resolve({
                    items: [
                        makeGoogleTask({ id: 'deleted', deleted: true }),
                        makeGoogleTask({ id: 'hidden', hidden: true }),
                        makeGoogleTask({ id: 'visible', title: 'Visible' }),
                    ],
                });
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0].sourceId).toBe('list-a:visible');
        });

        it('returns empty array when list has no items', async () => {
            mockHttp.get.mockImplementation((path: string) => {
                if (path === '/users/@me/lists') return Promise.resolve({ items: [listA] });
                return Promise.resolve({});
            });

            const tasks = await source.fetchTasks(tokens);

            expect(tasks).toHaveLength(0);
        });
    });

    describe('createTask', () => {
        it('creates a task in the first list and returns RemoteTask', async () => {
            mockHttp.get.mockResolvedValue({ items: [listA] });
            mockHttp.post.mockResolvedValue(makeGoogleTask({ id: 'new-task', title: 'New Task' }));

            const task = await source.createTask(tokens, { title: 'New Task' });

            expect(mockHttp.post).toHaveBeenCalledWith(
                '/lists/list-a/tasks',
                { title: 'New Task', notes: '', due: undefined },
                { Authorization: `Bearer ${tokens.accessToken}` },
            );
            expect(task.sourceId).toBe('list-a:new-task');
            expect(task.title).toBe('New Task');
        });

        it('throws when no task lists exist', async () => {
            mockHttp.get.mockResolvedValue({ items: [] });

            await expect(source.createTask(tokens, { title: 'Task' })).rejects.toThrow('No Google Task lists found');
        });
    });

    describe('updateTask', () => {
        it('patches the correct list/task and returns updated RemoteTask', async () => {
            const updated = makeGoogleTask({ id: 'task-1', title: 'Updated' });
            mockHttp.patch.mockResolvedValue(updated);

            const result = await source.updateTask(tokens, 'list-a:task-1', { title: 'Updated' });

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/lists/list-a/tasks/task-1',
                { title: 'Updated', notes: undefined, due: undefined },
                { Authorization: `Bearer ${tokens.accessToken}` },
            );
            expect(result.title).toBe('Updated');
        });
    });

    describe('completeTask', () => {
        it('patches status to completed', async () => {
            mockHttp.patch.mockResolvedValue({});

            await source.completeTask(tokens, 'list-a:task-1');

            expect(mockHttp.patch).toHaveBeenCalledWith(
                '/lists/list-a/tasks/task-1',
                { status: 'completed' },
                { Authorization: `Bearer ${tokens.accessToken}` },
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the correct list/task', async () => {
            mockHttp.delete.mockResolvedValue(undefined);

            await source.deleteTask(tokens, 'list-a:task-1');

            expect(mockHttp.delete).toHaveBeenCalledWith('/lists/list-a/tasks/task-1', {
                Authorization: `Bearer ${tokens.accessToken}`,
            });
        });
    });
});
