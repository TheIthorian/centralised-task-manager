import { type Logger, HttpClient } from '@ctm/http-client';
import { ExternalServiceError } from '@ctm/errors';

import { TaskConnectorName } from '../types.js';
import type { CreateTaskDto, ExternalTaskSource, OAuthTokens, RemoteTask, UpdateTaskDto } from '../types.js';
import type { GoogleTaskList, GoogleTask } from './google-tasks.types.js';

/** Configuration required to instantiate a {@link GoogleTasksTaskSource}. */
export type GoogleTasksTaskSourceConfig = {
    logger?: Logger;
};

/** ExternalTaskSource implementation for the Google Tasks API. */
export class GoogleTasksTaskSource implements ExternalTaskSource {
    readonly name = TaskConnectorName.GoogleTasks;

    private readonly http: HttpClient;

    constructor(config: GoogleTasksTaskSourceConfig) {
        this.http = new HttpClient({ baseUrl: 'https://tasks.googleapis.com/tasks/v1', logger: config.logger });
    }

    /** Fetch all tasks across all task lists. */
    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };
        const { items: lists } = await this.http.get<{ items: GoogleTaskList[] }>('/users/@me/lists', authHeader);

        const taskArrays = await Promise.all(
            lists.map(async (list) => {
                const { items = [] } = await this.http.get<{ items?: GoogleTask[] }>(
                    `/lists/${list.id}/tasks?showCompleted=true&showHidden=false`,
                    authHeader,
                );

                return items.filter((t) => !t.deleted && !t.hidden).map((t) => this.toRemoteTask(list.id, t));
            }),
        );

        return taskArrays.flat();
    }

    /** Create a new task in the first task list. */
    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const listId = await this.getFirstListId(tokens);
        const created = await this.http.post<GoogleTask>(
            `/lists/${listId}/tasks`,
            {
                title: task.title,
                notes: task.description ?? '',
                due: task.due?.date.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(listId, created);
    }

    /** Update an existing task. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        const updated = await this.http.patch<GoogleTask>(
            `/lists/${listId}/tasks/${taskId}`,
            {
                title: patch.title,
                notes: patch.description,
                due: patch.due?.date.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(listId, updated);
    }

    /** Mark a task as completed. */
    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.patch<unknown>(
            `/lists/${listId}/tasks/${taskId}`,
            { status: 'completed' },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );
    }

    /** Delete a task. */
    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.delete(`/lists/${listId}/tasks/${taskId}`, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });
    }

    private async getFirstListId(tokens: OAuthTokens): Promise<string> {
        const { items } = await this.http.get<{ items: GoogleTaskList[] }>('/users/@me/lists', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        if (!items.length) throw new ExternalServiceError(this.name, 'No Google Task lists found');

        return items[0].id;
    }

    private splitSourceId(sourceId: string): [string, string] {
        const idx = sourceId.indexOf(':');
        return [sourceId.slice(0, idx), sourceId.slice(idx + 1)];
    }

    private toRemoteTask(listId: string, task: GoogleTask): RemoteTask {
        return {
            sourceId: `${listId}:${task.id}`,
            title: task.title,
            description: task.notes ?? null,
            status: task.status === 'completed' ? 'done' : 'open',
            priority: null,
            due: task.due ? { date: new Date(task.due), timezone: null, recurrence: null } : null,
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: [],
        };
    }
}
