import {
    ApiClientError,
    CtmApiClient,
    type ConnectorHealthDto,
    type ConnectorStatusDto,
    type DiscordStatusDto,
    type MarkAllReadResultDto,
    type MarkReadResultDto,
    type NotificationDto,
    type OkDto,
    type ReminderDto,
    type TaskDto,
    type TaskSyncJobDto,
    type TokenPair,
    type UserDto,
} from '@ctm/api-client';
import type { StoredAuthTokens } from '../auth/auth-storage.js';
import type {
    WebAddReminderParams,
    WebApiClientOptions,
    WebApiError,
    WebCancelSyncJobParams,
    WebConnectorParams,
    WebCreateTaskParams,
    WebDeleteTaskParams,
    WebGetSyncJobParams,
    WebListTasksParams,
    WebLoginParams,
    WebRegisterParams,
    WebRemoveFuzzyDeadlineParams,
    WebRemoveReminderParams,
    WebSetFuzzyDeadlineParams,
    WebSetTaskStatusParams,
    WebSyncConnectorParams,
    WebUpdateMeParams,
    WebUpdateTaskParams,
} from './web-api-client.types.js';

/** Web-only API wrapper with refresh, redirect, and toast behavior. */
export class WebApiClient {
    private readonly baseUrl: string;
    private readonly onTokens: (tokens: StoredAuthTokens) => void;
    private readonly onUnauthorized: () => void;
    private readonly onError: (error: WebApiError) => void;
    private accessToken: string | null;
    private refreshToken: string | null;
    private apiClient: CtmApiClient;

    constructor({ baseUrl, accessToken, refreshToken, onTokens, onUnauthorized, onError }: WebApiClientOptions) {
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.onTokens = onTokens;
        this.onUnauthorized = onUnauthorized;
        this.onError = onError;
        this.apiClient = this.createApiClient();
    }

    /** Login with email and password. */
    async login({ email, password }: WebLoginParams): Promise<TokenPair> {
        return this.execute({
            request: () => this.apiClient.login({ email, password }),
            retryOnUnauthorized: false,
            toastOnError: false,
        });
    }

    /** Register a new account. */
    async register({ name, email, password }: WebRegisterParams): Promise<TokenPair> {
        return this.execute({
            request: () => this.apiClient.register({ name, email, password }),
            retryOnUnauthorized: false,
            toastOnError: false,
        });
    }

    /** Get a single task by ID. */
    async getTask({ id }: { id: string }): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.getTask({ id }) });
    }

    /** List tasks for the current user. */
    async listTasks({ filter, lastUpdatedFromDate }: WebListTasksParams = {}): Promise<TaskDto[]> {
        return this.execute({ request: () => this.apiClient.listTasks({ filter, lastUpdatedFromDate }) });
    }

    /** Create a task for the current user. */
    async createTask({ dto }: WebCreateTaskParams): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.createTask({ dto }) });
    }

    /** Update a task for the current user. */
    async updateTask({ id, dto }: WebUpdateTaskParams): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.updateTask({ id, dto }) });
    }

    /** Set task status (complete or uncomplete). */
    async setTaskStatus({ id, dto }: WebSetTaskStatusParams): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.setTaskStatus({ id, dto }) });
    }

    /** Set the fuzzy deadline on a task. */
    async setFuzzyDeadline({ id, dto }: WebSetFuzzyDeadlineParams): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.setFuzzyDeadline({ id, dto }) });
    }

    /** Remove the fuzzy deadline from a task. */
    async removeFuzzyDeadline({ id }: WebRemoveFuzzyDeadlineParams): Promise<TaskDto> {
        return this.execute({ request: () => this.apiClient.removeFuzzyDeadline({ id }) });
    }

    /** Add a reminder datetime to a task. */
    async addReminder({ id, dto }: WebAddReminderParams): Promise<ReminderDto> {
        return this.execute({ request: () => this.apiClient.addReminder({ id, dto }) });
    }

    /** Remove a reminder from a task by its array index. */
    async removeReminder({ id, index }: WebRemoveReminderParams): Promise<OkDto> {
        return this.execute({ request: () => this.apiClient.removeReminder({ id, index }) });
    }

    /** Delete a task for the current user. */
    async deleteTask({ id }: WebDeleteTaskParams): Promise<void> {
        await this.execute({ request: () => this.apiClient.deleteTask({ id }) });
    }

    /** List connector statuses for the current user. */
    async listConnectors(): Promise<ConnectorStatusDto[]> {
        return this.execute({ request: () => this.apiClient.listConnectors() });
    }

    /** Health-check all connected task-sync connectors for the current user. */
    async getConnectorHealth(): Promise<ConnectorHealthDto[]> {
        return this.execute({ request: () => this.apiClient.getConnectorHealth() });
    }

    /** Get the OAuth URL for a connector. */
    async getConnectorAuthUrl({ source }: WebConnectorParams): Promise<string> {
        return this.execute({ request: () => this.apiClient.getConnectorAuthUrl({ source }) });
    }

    /** Disconnect a connector for the current user. */
    async disconnectConnector({ source }: WebConnectorParams): Promise<void> {
        await this.execute({ request: () => this.apiClient.disconnectConnector({ source }) });
    }

    /** Start a pull-sync job for a connected source. */
    async syncConnector({ source }: WebSyncConnectorParams): Promise<TaskSyncJobDto> {
        return this.execute({ request: () => this.apiClient.syncConnector({ source }) });
    }

    /** Get the status of a sync job. */
    async getSyncJob({ source, jobId }: WebGetSyncJobParams): Promise<TaskSyncJobDto> {
        return this.execute({ request: () => this.apiClient.getSyncJob({ source, jobId }) });
    }

    /** Cancel a sync job. */
    async cancelSyncJob({ source, jobId }: WebCancelSyncJobParams): Promise<void> {
        await this.execute({ request: () => this.apiClient.cancelSyncJob({ source, jobId }) });
    }

    /** Get the current user profile. */
    async getMe(): Promise<UserDto> {
        return this.execute({ request: () => this.apiClient.getMe() });
    }

    /** Update the current user profile. */
    async updateMe({ dto }: WebUpdateMeParams): Promise<UserDto> {
        return this.execute({ request: () => this.apiClient.updateMe({ dto }) });
    }

    /** Delete the current user profile. */
    async deleteMe(): Promise<void> {
        await this.execute({ request: () => this.apiClient.deleteMe() });
    }

    /** Get the Discord OAuth connect URL. */
    async getDiscordConnectUrl(): Promise<string> {
        return this.execute({ request: () => this.apiClient.getDiscordConnectUrl() });
    }

    /** Get Discord connection status. */
    async getDiscordStatus(): Promise<DiscordStatusDto> {
        return this.execute({ request: () => this.apiClient.getDiscordStatus() });
    }

    /** Disconnect Discord. */
    async disconnectDiscord(): Promise<void> {
        await this.execute({ request: () => this.apiClient.disconnectDiscord() });
    }

    /** Send a test notification via a channel (e.g. 'discord'). */
    async testNotificationChannel({ channel }: { channel: string }): Promise<{ sent: boolean }> {
        return this.execute({ request: () => this.apiClient.testNotificationChannel({ channel }) });
    }

    /** List in-app notifications for the current user. */
    async listNotifications({ unreadOnly = false }: { unreadOnly?: boolean } = {}): Promise<NotificationDto[]> {
        return this.execute({ request: () => this.apiClient.listNotifications({ unreadOnly }) });
    }

    /** Mark a single notification as read. */
    async markNotificationRead({ id }: { id: string }): Promise<MarkReadResultDto> {
        return this.execute({ request: () => this.apiClient.markNotificationRead({ id }) });
    }

    /** Mark all notifications as read. */
    async markAllNotificationsRead(): Promise<MarkAllReadResultDto> {
        return this.execute({ request: () => this.apiClient.markAllNotificationsRead() });
    }

/** Save connection details for a connector (e.g. Notion database ID). */
    async setConnectionDetails({ source, details }: { source: string; details: Record<string, unknown> }): Promise<void> {
        await this.execute({ request: () => this.apiClient.setConnectionDetails({ source, details }) });
    }

    /** List Notion databases accessible via the user's Notion integration. */
    async listNotionDatabases(): Promise<{ id: string; name: string }[]> {
        return this.execute({ request: () => this.apiClient.listNotionDatabases() });
    }

    /** Return the current access token (used for WebSocket authentication). */
    getAccessToken(): string | null {
        return this.accessToken;
    }

    /** Return the API base URL (used for WebSocket connection). */
    getBaseUrl(): string {
        return this.baseUrl;
    }

    private createApiClient(): CtmApiClient {
        return new CtmApiClient({
            baseUrl: this.baseUrl,
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
        });
    }

    private setTokens({ accessToken, refreshToken }: StoredAuthTokens): void {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.apiClient = this.createApiClient();
        this.onTokens({ accessToken, refreshToken });
    }

    private async execute<T>({
        request,
        retryOnUnauthorized = true,
        toastOnError = true,
    }: {
        request: () => Promise<T>;
        retryOnUnauthorized?: boolean;
        toastOnError?: boolean;
    }): Promise<T> {
        try {
            return await request();
        } catch (error) {
            if (error instanceof ApiClientError && error.statusCode === 401 && retryOnUnauthorized) {
                return this.retryWithRefresh({ request, error, toastOnError });
            }

            const normalizedError = this.normalizeError(error);

            if (normalizedError.code === 'unauthorized') {
                this.onUnauthorized();
            } else if (toastOnError) {
                this.onError(normalizedError);
            }

            throw normalizedError;
        }
    }

    private async retryWithRefresh<T>({
        request,
        error,
        toastOnError,
    }: {
        request: () => Promise<T>;
        error: ApiClientError;
        toastOnError: boolean;
    }): Promise<T> {
        if (!this.refreshToken) {
            const normalizedError = this.normalizeError(error);
            this.onUnauthorized();
            throw normalizedError;
        }

        try {
            const refreshClient = new CtmApiClient({
                baseUrl: this.baseUrl,
                refreshToken: this.refreshToken,
            });
            const nextTokens = await refreshClient.refresh();

            this.setTokens({
                accessToken: nextTokens.accessToken,
                refreshToken: nextTokens.refreshToken,
            });

            return await request();
        } catch (refreshError) {
            const normalizedError = this.normalizeError(refreshError);

            this.onUnauthorized();

            if (toastOnError && normalizedError.code !== 'unauthorized') {
                this.onError(normalizedError);
            }

            throw normalizedError;
        }
    }

    private normalizeError(error: unknown): WebApiError {
        if (error instanceof ApiClientError) {
            return {
                statusCode: error.statusCode,
                code: this.statusToCode(error.statusCode),
                message: this.normalizeMessage(error),
                cause: error,
            };
        }

        if (error instanceof Error) {
            return {
                statusCode: 0,
                code: 'unknown',
                message: error.message,
                cause: error,
            };
        }

        return {
            statusCode: 0,
            code: 'unknown',
            message: 'Unknown API error',
            cause: error,
        };
    }

    private statusToCode(statusCode: number): WebApiError['code'] {
        if (statusCode === 401) return 'unauthorized';
        if (statusCode === 403) return 'forbidden';
        if (statusCode === 400 || statusCode === 422) return 'validation';
        if (statusCode >= 500) return 'server';
        if (statusCode === 0) return 'network';

        return 'unknown';
    }

    private normalizeMessage(error: ApiClientError): string {
        if (error.statusCode === 0) {
            return 'Network request failed.';
        }

        if (error.responseBody && typeof error.responseBody === 'object' && 'message' in error.responseBody) {
            const message = error.responseBody.message;

            if (typeof message === 'string' && message.length > 0) return message;

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
