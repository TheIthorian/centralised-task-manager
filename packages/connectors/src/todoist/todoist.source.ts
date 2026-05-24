import { type Logger, HttpClient } from '@ctm/http-client';

import { TaskConnectorName } from '../types.js';
import type { CreateTaskDto, ExternalTaskSource, HealthCheckResult, OAuthTokens, RemoteTask, UpdateTaskDto } from '../types.js';
import type { TodoistTask, TodoistTasksResponse } from './todoist.types.js';
import { todoistStringToRrule, rruleToTodoistString } from './todoist-recurrence.js';

/** Configuration required to instantiate a {@link TodoistTaskSource}. */
export type TodoistTaskSourceConfig = {
    logger?: Logger;
};

/** Manage tasks that live in Todoist */
export class TodoistTaskSource implements ExternalTaskSource {
    readonly name = TaskConnectorName.Todoist;

    private readonly http: HttpClient;

    constructor(private readonly config: TodoistTaskSourceConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.todoist.com/api/v1', logger: config.logger });
    }

    /** Probe the Todoist API to verify the connection is healthy. */
    async healthCheck(tokens: OAuthTokens): Promise<HealthCheckResult> {
        try {
            await this.http.get<unknown>('/tasks', { Authorization: `Bearer ${tokens.accessToken}` });
            return { healthy: true };
        } catch (err) {
            return { healthy: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }

    /** Fetch all open tasks from the authenticated user's Todoist account. */
    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const res = await this.http.get<TodoistTasksResponse>('/tasks', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return res.results.map((t) => this.toRemoteTask(t));
    }

    /** Create a new task in Todoist. */
    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const body: Record<string, unknown> = {
            content: task.title,
            description: task.description ?? '',
            priority: task.priority ?? 1,
        };

        if (task.due) {
            body['due_date'] = task.due.date.toISOString().split('T')[0];

            if (task.due.recurrence) {
                body['due_string'] = rruleToTodoistString(task.due.recurrence);
            }
        }

        if (task.deadlineDate) {
            body['deadline'] = { date: task.deadlineDate.toISOString().split('T')[0] };
        }

        if (task.duration) {
            body['duration'] = task.duration.amount;
            body['duration_unit'] = task.duration.unit;
        }

        const created = await this.http.post<TodoistTask>('/tasks', body, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return this.toRemoteTask(created);
    }

    /** Update an existing task in Todoist. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const body: Record<string, unknown> = {
            content: patch.title,
            description: patch.description,
            priority: patch.priority,
        };

        if (patch.due !== undefined) {
            if (patch.due === null) {
                body['due_date'] = null;
            } else {
                body['due_date'] = patch.due.date.toISOString().split('T')[0];

                if (patch.due.recurrence) {
                    body['due_string'] = rruleToTodoistString(patch.due.recurrence);
                }
            }
        }

        if (patch.deadlineDate !== undefined) {
            body['deadline'] = patch.deadlineDate ? { date: patch.deadlineDate.toISOString().split('T')[0] } : null;
        }

        if (patch.duration !== undefined) {
            body['duration'] = patch.duration?.amount ?? null;
            body['duration_unit'] = patch.duration?.unit ?? null;
        }

        // Todoist REST v2 uses POST (not PATCH) for task updates
        const updated = await this.http.post<TodoistTask>(`/tasks/${sourceId}`, body, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return this.toRemoteTask(updated);
    }

    /** Mark a task as complete by posting to the close endpoint. */
    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.post<void>(`/tasks/${sourceId}/close`, {}, { Authorization: `Bearer ${tokens.accessToken}` });
    }

    /** Permanently delete a task from Todoist. */
    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.delete(`/tasks/${sourceId}`, { Authorization: `Bearer ${tokens.accessToken}` });
    }

    private toRemoteTask(task: TodoistTask): RemoteTask {
        const due = task.due
            ? {
                  date: new Date(task.due.date),
                  timezone: task.due.timezone,
                  recurrence: task.due.is_recurring ? todoistStringToRrule(task.due.string, this.config.logger) : null,
              }
            : null;

        return {
            sourceId: task.id,
            title: task.content,
            description: task.description !== '' ? task.description : null,
            status: task.checked ? 'done' : 'open',
            priority: task.priority,
            due,
            deadline: task.deadline ? new Date(task.deadline.date) : null,
            duration: task.duration ?? null,
            parentSourceId: task.parent_id,
            tags: task.labels,
        };
    }
}
