import { type Logger, HttpClient } from '@ctm/http-client';

import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';

export type TodoistConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

/** Todoist API task object. See: https://developer.todoist.com/rest/reference#get-active-tasks */
interface TodoistTask {
    user_id: string;
    id: string;
    project_id: string;
    section_id: string | null;
    parent_id: string | null;
    added_by_uid: string;
    assigned_by_uid: string | null;
    responsible_uid: string | null;
    labels: string[];
    deadline: null;
    duration: null;
    is_collapsed: boolean;
    checked: boolean;
    is_deleted: boolean;
    added_at: string;
    completed_at: string | null;
    completed_by_uid: string | null;
    updated_at: string;
    due: { date: string; timezone: string | null; string: string; lang: string; is_recurring: boolean } | null;
    priority: number;
    child_order: number;
    content: string;
    description: string;
    note_count: number;
    day_order: number;
    goal_ids: string[];
}

interface TodoistTokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
}

interface TodoistTasksResponse {
    results: TodoistTask[];
    next_cursor: string | null;
}

export class TodoistConnector implements TaskConnector {
    readonly source = 'todoist';

    private readonly http: HttpClient;
    private readonly authHttp: HttpClient;

    constructor(private readonly config: TodoistConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.todoist.com/api/v1', logger: config.logger });
        this.authHttp = new HttpClient({ baseUrl: 'https://todoist.com', logger: config.logger });
    }

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

    /** Exchange authorization code for OAuth tokens. New apps receive short-lived access tokens with a refresh token. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.authHttp.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? '',
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    }

    /** Refresh an expired access token using the stored refresh token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        if (!tokens.refreshToken) {
            return tokens;
        }

        const res = await this.authHttp.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: tokens.refreshToken,
        });

        const expiresIn = res.expires_in ?? 365 * 24 * 60 * 60;

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
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
        const created = await this.http.post<TodoistTask>(
            '/tasks',
            {
                content: task.title,
                description: task.description ?? '',
                due_date: task.dueDate?.toISOString().split('T')[0],
                priority: task.priority ?? 1,
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(created);
    }

    /** Update an existing task in Todoist. */
    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        // Todoist REST v2 uses POST (not PATCH) for task updates
        const updated = await this.http.post<TodoistTask>(
            `/tasks/${sourceId}`,
            {
                content: patch.title,
                description: patch.description,
                due_date: patch.dueDate?.toISOString().split('T')[0],
                priority: patch.priority,
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

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
        return {
            sourceId: task.id,
            title: task.content,
            description: task.description !== '' ? task.description : null,
            status: task.checked ? 'done' : 'open',
            priority: task.priority,
            dueDate: task.due ? new Date(task.due.date) : null,
            tags: task.labels,
        };
    }
}
