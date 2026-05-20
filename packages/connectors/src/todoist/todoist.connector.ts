import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { ExternalServiceError } from '@ctm/errors';
import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';

export interface TodoistConnectorConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface TodoistTask {
    id: string;
    content: string;
    description: string;
    is_completed: boolean;
    priority: number;
    due: { date: string } | null;
    labels: string[];
}

interface TodoistTokenResponse {
    access_token: string;
    token_type: string;
}

export class TodoistConnector implements TaskConnector {
    readonly source = 'todoist';

    private readonly http: AxiosInstance = axios.create({
        baseURL: 'https://api.todoist.com/rest/v2',
        headers: { 'Content-Type': 'application/json' },
    });

    private readonly authHttp: AxiosInstance = axios.create({
        baseURL: 'https://todoist.com',
        headers: { 'Content-Type': 'application/json' },
    });

    constructor(private readonly config: TodoistConnectorConfig) {}

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: 'task:add,data:read,data:delete',
            state: userId,
            redirect_uri: this.config.redirectUri,
        });

        return `https://todoist.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Todoist access tokens are long-lived (no expiry) and do not support refresh.
     * refreshToken is stored as '' and refreshToken() is intentionally a no-op.
     */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.call<TodoistTokenResponse>(() =>
            this.authHttp.post('/oauth/access_token', {
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                redirect_uri: this.config.redirectUri,
            }),
        );

        return {
            accessToken: res.access_token,
            refreshToken: '',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        };
    }

    /** Todoist tokens do not expire; return tokens unchanged. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        return tokens;
    }

    /** Fetch all open tasks from the authenticated user's Todoist account. */
    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const tasks = await this.call<TodoistTask[]>(() =>
            this.http.get('/tasks', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }),
        );

        return tasks.map((t) => this.toRemoteTask(t));
    }

    /** Create a new task in Todoist. */
    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const created = await this.call<TodoistTask>(() =>
            this.http.post(
                '/tasks',
                {
                    content: task.title,
                    description: task.description ?? '',
                    due_date: task.dueDate?.toISOString().split('T')[0],
                    priority: task.priority ?? 1,
                },
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );

        return this.toRemoteTask(created);
    }

    /** Update an existing task in Todoist. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        // Todoist REST v2 uses POST (not PATCH) for task updates
        const updated = await this.call<TodoistTask>(() =>
            this.http.post(
                `/tasks/${sourceId}`,
                {
                    content: patch.title,
                    description: patch.description,
                    due_date: patch.dueDate?.toISOString().split('T')[0],
                    priority: patch.priority,
                },
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );

        return this.toRemoteTask(updated);
    }

    /** Mark a task as complete by posting to the close endpoint. */
    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.call<void>(() =>
            this.http.post(
                `/tasks/${sourceId}/close`,
                {},
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );
    }

    /** Permanently delete a task from Todoist. */
    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.call<void>(() =>
            this.http.delete(`/tasks/${sourceId}`, {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            }),
        );
    }

    /** Wrap an axios call, mapping AxiosError → ExternalServiceError. */
    private async call<T>(fn: () => Promise<AxiosResponse<T>>): Promise<T> {
        try {
            const res = await fn();

            return res.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status ?? 0;
                const body = error.response?.data;
                const text = typeof body === 'string' ? body : body !== undefined ? JSON.stringify(body) : '';

                throw new ExternalServiceError(this.source, `HTTP ${status}: ${text}`);
            }

            throw error;
        }
    }

    private toRemoteTask(task: TodoistTask): RemoteTask {
        return {
            sourceId: task.id,
            title: task.content,
            description: task.description !== '' ? task.description : null,
            status: task.is_completed ? 'done' : 'open',
            priority: task.priority,
            dueDate: task.due ? new Date(task.due.date) : null,
            tags: task.labels,
        };
    }
}
