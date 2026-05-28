import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
    AuthorizedAppDto,
    ConnectorHealthDto,
    ConnectorStatusDto,
    DiscordStatusDto,
    MarkAllReadResultDto,
    MarkReadResultDto,
    NotificationDto,
    NotificationPreferencesDto,
    OkDto,
    ReminderDto,
    TaskDto,
    TaskFilter,
    TaskSyncJobDto,
    TestChannelResultDto,
    TokenPair,
    UserDto,
} from './types.js';
import type {
    AddReminderParams,
    GetTaskParams,
    ApiClientErrorOptions,
    ApiClientOptions,
    CancelSyncJobParams,
    CreateTaskParams,
    DeleteTaskParams,
    DisconnectConnectorParams,
    GetConnectorAuthUrlParams,
    GetSyncJobParams,
    ListNotificationsParams,
    ListTasksParams,
    LoginParams,
    MarkNotificationReadParams,
    RefreshParams,
    RegisterParams,
    RemoveFuzzyDeadlineParams,
    RemoveReminderParams,
    RevokeAuthorizedAppParams,
    SetConnectionDetailsParams,
    SetFuzzyDeadlineParams,
    SetTaskStatusParams,
    SyncConnectorParams,
    UpdateMeParams,
    UpdateNotificationPreferencesParams,
    UpdateTaskParams,
} from './client.types.js';

/** Structured HTTP error returned by the REST wrapper. */
export class ApiClientError extends Error {
    readonly statusCode: number;
    readonly method: string;
    readonly path: string;
    readonly responseBody?: unknown;

    constructor({ message, statusCode, method, path, responseBody }: ApiClientErrorOptions) {
        super(message);
        this.name = 'ApiClientError';
        this.statusCode = statusCode;
        this.method = method;
        this.path = path;
        this.responseBody = responseBody;
    }
}

/** Pure typed REST client for the CTM API. */
export class CtmApiClient {
    private readonly client: AxiosInstance;
    private readonly refreshToken: string | null;

    constructor({ baseUrl, accessToken, refreshToken }: ApiClientOptions) {
        this.client = axios.create({
            baseURL: baseUrl,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        this.refreshToken = refreshToken ?? null;
    }

    /** Login with email and password. */
    async login({ email, password }: LoginParams): Promise<TokenPair> {
        return this.request<TokenPair>({ method: 'POST', path: '/auth/login', body: { email, password } });
    }

    /** Register a new account. */
    async register({ name, email, password }: RegisterParams): Promise<TokenPair> {
        return this.request<TokenPair>({ method: 'POST', path: '/auth/register', body: { name, email, password } });
    }

    /** Exchange a refresh token for a new token pair. */
    async refresh({ refreshToken }: RefreshParams = {}): Promise<TokenPair> {
        const token = refreshToken ?? this.refreshToken;

        if (!token) {
            throw new ApiClientError({
                message: 'No refresh token available',
                statusCode: 0,
                method: 'POST',
                path: '/auth/refresh',
            });
        }

        return this.request<TokenPair>({ method: 'POST', path: '/auth/refresh', body: { refreshToken: token } });
    }

    /** List tasks, optionally filtered by UI filter and/or update date. */
    async listTasks({ filter = 'all', lastUpdatedFromDate }: ListTasksParams = {}): Promise<TaskDto[]> {
        const params = this.filterToParams(filter);

        if (lastUpdatedFromDate) params['lastUpdatedFromDate'] = lastUpdatedFromDate;

        return this.request<TaskDto[]>({
            method: 'GET',
            path: '/tasks',
            params,
        });
    }

    /** Get a single task by ID. */
    async getTask({ id }: GetTaskParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'GET', path: `/tasks/${id}` });
    }

    /** Create a new task. */
    async createTask({ dto }: CreateTaskParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'POST', path: '/tasks', body: dto });
    }

    /** Update an existing task. */
    async updateTask({ id, dto }: UpdateTaskParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'PATCH', path: `/tasks/${id}`, body: dto });
    }

    /** Delete a task permanently. */
    async deleteTask({ id }: DeleteTaskParams): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: `/tasks/${id}` });
    }

    /** Set task status to 'open' or 'done'. */
    async setTaskStatus({ id, dto }: SetTaskStatusParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'PUT', path: `/tasks/${id}/status`, body: dto });
    }

    /** Set the fuzzy deadline for an existing task. */
    async setFuzzyDeadline({ id, dto }: SetFuzzyDeadlineParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'PATCH', path: `/tasks/${id}/fuzzy-deadline`, body: dto });
    }

    /** Remove the fuzzy deadline from a task. */
    async removeFuzzyDeadline({ id }: RemoveFuzzyDeadlineParams): Promise<TaskDto> {
        return this.request<TaskDto>({ method: 'DELETE', path: `/tasks/${id}/fuzzy-deadline` });
    }

    /** Add a reminder datetime to a task. */
    async addReminder({ id, dto }: AddReminderParams): Promise<ReminderDto> {
        return this.request<ReminderDto>({ method: 'POST', path: `/tasks/${id}/reminders`, body: dto });
    }

    /** Remove a reminder from a task by its index in the reminders array. */
    async removeReminder({ id, index }: RemoveReminderParams): Promise<OkDto> {
        return this.request<OkDto>({ method: 'DELETE', path: `/tasks/${id}/reminders/${index}` });
    }

    /** List all connector statuses for the current user. */
    async listConnectors(): Promise<ConnectorStatusDto[]> {
        return this.request<ConnectorStatusDto[]>({ method: 'GET', path: '/connectors' });
    }

    /** Health-check all connected task-sync connectors for the current user. */
    async getConnectorHealth(): Promise<ConnectorHealthDto[]> {
        return this.request<ConnectorHealthDto[]>({ method: 'GET', path: '/connectors/health' });
    }

    /** Get the OAuth authorisation URL for a connector source. */
    async getConnectorAuthUrl({ source }: GetConnectorAuthUrlParams): Promise<string> {
        const response = await this.request<{ url: string }>({ method: 'GET', path: `/connectors/${source}/auth` });

        return response.url;
    }

    /** Disconnect a connector source. */
    async disconnectConnector({ source }: DisconnectConnectorParams): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: `/connectors/${source}` });
    }

    /** Start a pull-sync job for a connected source. */
    async syncConnector({ source }: SyncConnectorParams): Promise<TaskSyncJobDto> {
        return this.request<TaskSyncJobDto>({ method: 'POST', path: `/connectors/${source}/sync` });
    }

    /** Get the status of a sync job. */
    async getSyncJob({ source, jobId }: GetSyncJobParams): Promise<TaskSyncJobDto> {
        return this.request<TaskSyncJobDto>({ method: 'GET', path: `/connectors/${source}/sync/${jobId}` });
    }

    /** Cancel a sync job. */
    async cancelSyncJob({ source, jobId }: CancelSyncJobParams): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: `/connectors/${source}/sync/${jobId}` });
    }

/** Save connection details for a connector (e.g. Notion database ID). */
    async setConnectionDetails({ source, details }: SetConnectionDetailsParams): Promise<void> {
        await this.request<void>({ method: 'POST', path: `/connectors/${source}/connection-details`, body: details });
    }

    /** List Notion databases accessible via the user's Notion integration. */
    async listNotionDatabases(): Promise<{ id: string; name: string }[]> {
        return this.request<{ id: string; name: string }[]>({ method: 'GET', path: '/connectors/notion/databases' });
    }

    /** Get the current user's profile. */
    async getMe(): Promise<UserDto> {
        return this.request<UserDto>({ method: 'GET', path: '/users/me' });
    }

    /** Update the current user's profile. */
    async updateMe({ dto }: UpdateMeParams): Promise<UserDto> {
        return this.request<UserDto>({ method: 'PATCH', path: '/users/me', body: dto });
    }

    /** Permanently delete the current user's account. */
    async deleteMe(): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: '/users/me' });
    }

    /** List in-app notifications for the current user. */
    async listNotifications({ page = 1, limit = 20, unreadOnly = false }: ListNotificationsParams = {}): Promise<NotificationDto[]> {
        return this.request<NotificationDto[]>({
            method: 'GET',
            path: '/notifications',
            params: { page: String(page), limit: String(limit), unreadOnly: String(unreadOnly) },
        });
    }

    /** Mark a single notification as read. */
    async markNotificationRead({ id }: MarkNotificationReadParams): Promise<MarkReadResultDto> {
        return this.request<MarkReadResultDto>({ method: 'PATCH', path: `/notifications/${id}/read` });
    }

    /** Mark all notifications as read. */
    async markAllNotificationsRead(): Promise<MarkAllReadResultDto> {
        return this.request<MarkAllReadResultDto>({ method: 'PATCH', path: '/notifications/read-all' });
    }

    /** Get notification preferences for the current user. */
    async getNotificationPreferences(): Promise<NotificationPreferencesDto> {
        return this.request<NotificationPreferencesDto>({ method: 'GET', path: '/notifications/preferences' });
    }

    /** Update notification preferences (partial). */
    async updateNotificationPreferences({ dto }: UpdateNotificationPreferencesParams): Promise<NotificationPreferencesDto> {
        return this.request<NotificationPreferencesDto>({ method: 'PATCH', path: '/notifications/preferences', body: dto });
    }

    /** Get the Discord OAuth URL for connecting. */
    async getDiscordConnectUrl(): Promise<string> {
        const response = await this.request<{ url: string }>({ method: 'GET', path: '/connectors/discord/connect-url' });
        return response.url;
    }

    /** Get Discord connection status. */
    async getDiscordStatus(): Promise<DiscordStatusDto> {
        return this.request<DiscordStatusDto>({ method: 'GET', path: '/connectors/discord/status' });
    }

    /** Disconnect Discord. */
    async disconnectDiscord(): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: '/connectors/discord' });
    }

    /** Send a test notification via a channel (e.g. 'discord'). */
    async testNotificationChannel({ channel }: { channel: string }): Promise<TestChannelResultDto> {
        return this.request<TestChannelResultDto>({ method: 'POST', path: `/notifications/channels/${channel}/test` });
    }

    /** List OAuth apps the current user has authorized. */
    async getAuthorizedApps(): Promise<AuthorizedAppDto[]> {
        return this.request<AuthorizedAppDto[]>({ method: 'GET', path: '/auth/me/authorized-apps' });
    }

    /** Revoke access for an authorized OAuth app. */
    async revokeAuthorizedApp({ clientId }: RevokeAuthorizedAppParams): Promise<void> {
        await this.request<void>({ method: 'DELETE', path: `/auth/me/authorized-apps/${clientId}` });
    }

    private filterToParams(filter: TaskFilter): Record<string, string> {
        switch (filter) {
            case 'done':
                return { status: 'done' };
            case 'today':
                return { filter: 'today' };
            case 'upcoming':
                return { filter: 'upcoming' };
            case 'all':
            default:
                return {};
        }
    }

    private async request<T>({
        method,
        path,
        body,
        params,
    }: {
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        path: string;
        body?: unknown;
        params?: Record<string, string>;
    }): Promise<T> {
        try {
            const response = await this.client.request<T>({
                method,
                url: path,
                data: body,
                params,
            });

            return response.data;
        } catch (error) {
            throw this.toApiClientError({ error, method, path });
        }
    }

    private toApiClientError({
        error,
        method,
        path,
    }: {
        error: unknown;
        method: string;
        path: string;
    }): ApiClientError {
        if (axios.isAxiosError(error)) {
            return new ApiClientError({
                message: this.extractMessage(error),
                statusCode: error.response?.status ?? 0,
                method,
                path,
                responseBody: error.response?.data,
            });
        }

        if (error instanceof Error) {
            return new ApiClientError({
                message: error.message,
                statusCode: 0,
                method,
                path,
            });
        }

        return new ApiClientError({
            message: 'Unknown API client error',
            statusCode: 0,
            method,
            path,
            responseBody: error,
        });
    }

    private extractMessage(error: AxiosError): string {
        const responseBody = error.response?.data;

        if (typeof responseBody === 'string' && responseBody.length > 0) {
            return responseBody;
        }

        if (responseBody !== null && typeof responseBody === 'object' && 'message' in responseBody) {
            const { message } = responseBody;

            if (typeof message === 'string' && message.length > 0) {
                return message;
            }

            if (Array.isArray(message)) {
                const parts = message.filter((part): part is string => typeof part === 'string' && part.length > 0);

                if (parts.length > 0) {
                    return parts.join(', ');
                }
            }
        }

        return error.message;
    }
}
