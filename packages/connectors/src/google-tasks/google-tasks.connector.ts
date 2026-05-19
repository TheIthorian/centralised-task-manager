import crypto from 'crypto';
import { HttpClient } from '@ctm/http';
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

    private readonly http = new HttpClient({ baseUrl: 'https://tasks.googleapis.com/tasks/v1' });

    private readonly authHttp = new HttpClient({ baseUrl: 'https://oauth2.googleapis.com' });

    constructor(private readonly config: GoogleTasksConnectorConfig) {}

    getAuthUrl(userId: string): string {
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/tasks',
            access_type: 'offline',
            state: userId,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const response = await this.authHttp.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
            grant_type: 'authorization_code',
        });

        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token ?? '',
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const response = await this.authHttp.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: tokens.refreshToken,
            grant_type: 'refresh_token',
        });

        return {
            accessToken: response.access_token,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };
        const { items: lists } = await this.http.get<{ items: GoogleTaskList[] }>(
            '/users/@me/lists',
            authHeader,
        );

        const taskArrays = await Promise.all(
            lists.map(async list => {
                const { items = [] } = await this.http.get<{ items?: GoogleTask[] }>(
                    `/lists/${list.id}/tasks?showCompleted=true&showHidden=false`,
                    authHeader,
                );

                return items
                    .filter(t => !t.deleted && !t.hidden)
                    .map(t => this.toRemoteTask(list.id, t));
            }),
        );

        return taskArrays.flat();
    }

    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const listId = await this.getFirstListId(tokens);
        const created = await this.http.post<GoogleTask>(
            `/lists/${listId}/tasks`,
            {
                title: task.title,
                notes: task.description ?? '',
                due: task.dueDate?.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(listId, created);
    }

    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        const updated = await this.http.patch<GoogleTask>(
            `/lists/${listId}/tasks/${taskId}`,
            {
                title: patch.title,
                notes: patch.description,
                due: patch.dueDate?.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(listId, updated);
    }

    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.patch<GoogleTask>(
            `/lists/${listId}/tasks/${taskId}`,
            { status: 'completed' },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );
    }

    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.delete(`/lists/${listId}/tasks/${taskId}`, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });
    }

    private async getFirstListId(tokens: OAuthTokens): Promise<string> {
        const { items } = await this.http.get<{ items: GoogleTaskList[] }>(
            '/users/@me/lists',
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        if (!items.length) throw new Error('No Google Task lists found');
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
            dueDate: task.due ? new Date(task.due) : null,
            tags: [],
        };
    }
}
