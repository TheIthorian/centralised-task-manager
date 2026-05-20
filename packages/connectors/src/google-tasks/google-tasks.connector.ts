import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { ExternalServiceError } from '@ctm/errors';
import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';

export interface GoogleTasksConnectorConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface GoogleTaskList {
    id: string;
    title: string;
}

interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    status: 'needsAction' | 'completed';
    due?: string;
    deleted?: boolean;
    hidden?: boolean;
}

interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

export class GoogleTasksConnector implements TaskConnector {
    readonly source = 'google_tasks';

    private readonly http: AxiosInstance = axios.create({
        baseURL: 'https://tasks.googleapis.com/tasks/v1',
        headers: { 'Content-Type': 'application/json' },
    });

    private readonly authHttp: AxiosInstance = axios.create({
        baseURL: 'https://oauth2.googleapis.com',
        headers: { 'Content-Type': 'application/json' },
    });

    constructor(private readonly config: GoogleTasksConnectorConfig) {}

    /** PKCE deferred to a future version — requires app-level verifier state management */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/tasks',
            access_type: 'offline',
            state: userId,
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const response = await this.call<GoogleTokenResponse>(() =>
            this.authHttp.post('/token', {
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
                redirect_uri: this.config.redirectUri,
                grant_type: 'authorization_code',
            }),
        );

        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token ?? '',
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    /** Refresh an expired access token using the stored refresh token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const response = await this.call<GoogleTokenResponse>(() =>
            this.authHttp.post('/token', {
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: tokens.refreshToken,
                grant_type: 'refresh_token',
            }),
        );

        return {
            accessToken: response.access_token,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    /** Fetch all tasks across all task lists. */
    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };
        const { items: lists } = await this.call<{ items: GoogleTaskList[] }>(() =>
            this.http.get('/users/@me/lists', { headers: authHeader }),
        );

        const taskArrays = await Promise.all(
            lists.map(async (list) => {
                const { items = [] } = await this.call<{ items?: GoogleTask[] }>(() =>
                    this.http.get(`/lists/${list.id}/tasks`, {
                        params: { showCompleted: true, showHidden: false },
                        headers: authHeader,
                    }),
                );

                return items
                    .filter((t) => !t.deleted && !t.hidden)
                    .map((t) => this.toRemoteTask(list.id, t));
            }),
        );

        return taskArrays.flat();
    }

    /** Create a new task in the first task list. */
    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const listId = await this.getFirstListId(tokens);
        const created = await this.call<GoogleTask>(() =>
            this.http.post(
                `/lists/${listId}/tasks`,
                {
                    title: task.title,
                    notes: task.description ?? '',
                    due: task.dueDate?.toISOString(),
                },
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );

        return this.toRemoteTask(listId, created);
    }

    /** Update an existing task. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        const updated = await this.call<GoogleTask>(() =>
            this.http.patch(
                `/lists/${listId}/tasks/${taskId}`,
                {
                    title: patch.title,
                    notes: patch.description,
                    due: patch.dueDate?.toISOString(),
                },
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );

        return this.toRemoteTask(listId, updated);
    }

    /** Mark a task as completed. */
    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.call<unknown>(() =>
            this.http.patch(
                `/lists/${listId}/tasks/${taskId}`,
                { status: 'completed' },
                { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
            ),
        );
    }

    /** Delete a task. */
    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.call<void>(() =>
            this.http.delete(`/lists/${listId}/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            }),
        );
    }

    private async getFirstListId(tokens: OAuthTokens): Promise<string> {
        const { items } = await this.call<{ items: GoogleTaskList[] }>(() =>
            this.http.get('/users/@me/lists', {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
            }),
        );

        if (!items.length) throw new ExternalServiceError(this.source, 'No Google Task lists found');

        return items[0].id;
    }

    private splitSourceId(sourceId: string): [string, string] {
        const idx = sourceId.indexOf(':');
        return [sourceId.slice(0, idx), sourceId.slice(idx + 1)];
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

    private toRemoteTask(listId: string, task: GoogleTask): RemoteTask {
        return {
            sourceId: `${listId}:${task.id}`,
            title: task.title,
            description: task.notes ?? null,
            status: task.status === 'completed' ? 'done' : 'open',
            priority: null,
            dueDate: task.due ? new Date(task.due) : null,
            tags: [],
        };
    }
}
