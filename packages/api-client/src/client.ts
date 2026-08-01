import { AppConfigClient } from './domains/app-config/app-config.client.js';
import type { AppConfigDto } from './domains/app-config/app-config.types.js';
import { AuthClient } from './domains/auth/auth.client.js';
import type {
    AuthorizedAppDto,
    GetOAuthClientInfoParams,
    LoginParams,
    OAuthClientInfoDto,
    RefreshParams,
    RegisterParams,
    RevokeAuthorizedAppParams,
    TokenPair,
} from './domains/auth/auth.types.js';
import { ConnectorsClient } from './domains/connectors/connectors.client.js';
import type {
    ConnectorHealthDto,
    ConnectorStatusDto,
    DisconnectConnectorParams,
    DiscordStatusDto,
    GetConnectorAuthUrlParams,
    ListNotionDatabasesParams,
    SetConnectionDetailsParams,
} from './domains/connectors/connectors.types.js';
import { DataPortabilityClient } from './domains/data-portability/data-portability.client.js';
import type {
    DownloadExportFileParams,
    ExportResponseDto,
    ImportDataParams,
    ImportResponseDto,
} from './domains/data-portability/data-portability.types.js';
import { NotificationsClient } from './domains/notifications/notifications.client.js';
import type {
    ListNotificationsParams,
    MarkAllReadResultDto,
    MarkNotificationReadParams,
    MarkReadResultDto,
    NotificationDto,
    NotificationPreferencesDto,
    TestChannelResultDto,
    TestNotificationChannelParams,
    UpdateNotificationPreferencesParams,
} from './domains/notifications/notifications.types.js';
import type { OkDto } from './domains/shared.types.js';
import { SyncClient } from './domains/sync/sync.client.js';
import type {
    CancelSyncJobParams,
    GetSyncJobParams,
    SyncConnectorParams,
    TaskSyncJobDto,
} from './domains/sync/sync.types.js';
import { TasksClient } from './domains/tasks/tasks.client.js';
import type {
    AddReminderParams,
    AddRelationParams,
    CreateTaskParams,
    DeleteTaskParams,
    GetTaskParams,
    ListTasksParams,
    ReminderDto,
    RemoveFuzzyDeadlineParams,
    RemoveRelationParams,
    RemoveReminderParams,
    SetFuzzyDeadlineParams,
    SetTaskStatusParams,
    TaskDto,
    UpdateTaskParams,
} from './domains/tasks/tasks.types.js';
import { UsersClient } from './domains/users/users.client.js';
import type { UpdateMeParams, UserDto } from './domains/users/users.types.js';
import { ApiHttpClient } from './http/api-http-client.js';
import type { ApiClientOptions } from './http/http.types.js';

export { ApiClientError } from './http/api-client.error.js';

/**
 * Pure typed REST client for the CTM API.
 *
 * A flat facade over the per-domain clients in `./domains`, so callers keep a single
 * entry point while each domain stays independently readable.
 */
export class CtmApiClient {
    private readonly auth: AuthClient;
    private readonly tasks: TasksClient;
    private readonly connectors: ConnectorsClient;
    private readonly sync: SyncClient;
    private readonly users: UsersClient;
    private readonly dataPortability: DataPortabilityClient;
    private readonly notifications: NotificationsClient;
    private readonly appConfig: AppConfigClient;

    constructor({ baseUrl, accessToken, refreshToken }: ApiClientOptions) {
        const http = new ApiHttpClient({ baseUrl, accessToken });

        this.auth = new AuthClient({ http, refreshToken: refreshToken ?? null });
        this.tasks = new TasksClient({ http });
        this.connectors = new ConnectorsClient({ http });
        this.sync = new SyncClient({ http });
        this.users = new UsersClient({ http });
        this.dataPortability = new DataPortabilityClient({ http });
        this.notifications = new NotificationsClient({ http });
        this.appConfig = new AppConfigClient({ http });
    }

    /** Login with email and password. */
    async login(params: LoginParams): Promise<TokenPair> {
        return this.auth.login(params);
    }

    /** Register a new account. */
    async register(params: RegisterParams): Promise<TokenPair> {
        return this.auth.register(params);
    }

    /**
     * Exchange a refresh token for a new token pair. Web clients omit the token
     * and rely on the HttpOnly cookie.
     */
    async refresh(params: RefreshParams = {}): Promise<TokenPair> {
        return this.auth.refresh(params);
    }

    /** Revoke the current refresh token. */
    async logout(params: RefreshParams = {}): Promise<void> {
        await this.auth.logout(params);
    }

    /** List OAuth apps the current user has authorized. */
    async getAuthorizedApps(): Promise<AuthorizedAppDto[]> {
        return this.auth.getAuthorizedApps();
    }

    /** Revoke access for an authorized OAuth app. */
    async revokeAuthorizedApp(params: RevokeAuthorizedAppParams): Promise<void> {
        await this.auth.revokeAuthorizedApp(params);
    }

    /** Public metadata for an OAuth client, for a consent screen to describe who is asking. */
    async getOAuthClientInfo(params: GetOAuthClientInfoParams): Promise<OAuthClientInfoDto> {
        return this.auth.getOAuthClientInfo(params);
    }

    /** List tasks, optionally filtered by UI filter and/or update date. */
    async listTasks(params: ListTasksParams = {}): Promise<TaskDto[]> {
        return this.tasks.listTasks(params);
    }

    /** Get a single task by ID. */
    async getTask(params: GetTaskParams): Promise<TaskDto> {
        return this.tasks.getTask(params);
    }

    /** Create a new task. */
    async createTask(params: CreateTaskParams): Promise<TaskDto> {
        return this.tasks.createTask(params);
    }

    /** Update an existing task. */
    async updateTask(params: UpdateTaskParams): Promise<TaskDto> {
        return this.tasks.updateTask(params);
    }

    /** Delete a task permanently. */
    async deleteTask(params: DeleteTaskParams): Promise<void> {
        await this.tasks.deleteTask(params);
    }

    /** Set task status to 'open' or 'done'. */
    async setTaskStatus(params: SetTaskStatusParams): Promise<TaskDto> {
        return this.tasks.setTaskStatus(params);
    }

    /** Set the fuzzy deadline for an existing task. */
    async setFuzzyDeadline(params: SetFuzzyDeadlineParams): Promise<TaskDto> {
        return this.tasks.setFuzzyDeadline(params);
    }

    /** Remove the fuzzy deadline from a task. */
    async removeFuzzyDeadline(params: RemoveFuzzyDeadlineParams): Promise<TaskDto> {
        return this.tasks.removeFuzzyDeadline(params);
    }

    /** Add a reminder datetime to a task. */
    async addReminder(params: AddReminderParams): Promise<ReminderDto> {
        return this.tasks.addReminder(params);
    }

    /** Remove a reminder from a task by its index in the reminders array. */
    async removeReminder(params: RemoveReminderParams): Promise<OkDto> {
        return this.tasks.removeReminder(params);
    }

    /** Add a typed relation between two tasks. */
    async addRelation(params: AddRelationParams): Promise<TaskDto> {
        return this.tasks.addRelation(params);
    }

    /** Remove a typed relation between two tasks. */
    async removeRelation(params: RemoveRelationParams): Promise<TaskDto> {
        return this.tasks.removeRelation(params);
    }

    /** List all connector statuses for the current user. */
    async listConnectors(): Promise<ConnectorStatusDto[]> {
        return this.connectors.listConnectors();
    }

    /** Health-check all connected task-sync connectors for the current user. */
    async getConnectorHealth(): Promise<ConnectorHealthDto[]> {
        return this.connectors.getConnectorHealth();
    }

    /** Get the OAuth authorisation URL for a connector source. */
    async getConnectorAuthUrl(params: GetConnectorAuthUrlParams): Promise<string> {
        return this.connectors.getConnectorAuthUrl(params);
    }

    /** Disconnect a single connection by id. */
    async disconnectConnector(params: DisconnectConnectorParams): Promise<void> {
        await this.connectors.disconnectConnector(params);
    }

    /** Save connection details for a connection (e.g. Notion database ID). */
    async setConnectionDetails(params: SetConnectionDetailsParams): Promise<void> {
        await this.connectors.setConnectionDetails(params);
    }

    /** List Notion databases accessible via a connection's Notion integration. */
    async listNotionDatabases(params: ListNotionDatabasesParams): Promise<{ id: string; name: string }[]> {
        return this.connectors.listNotionDatabases(params);
    }

    /** Get the Discord OAuth URL for connecting. */
    async getDiscordConnectUrl(): Promise<string> {
        return this.connectors.getDiscordConnectUrl();
    }

    /** Get Discord connection status. */
    async getDiscordStatus(): Promise<DiscordStatusDto> {
        return this.connectors.getDiscordStatus();
    }

    /** Disconnect Discord. */
    async disconnectDiscord(): Promise<void> {
        await this.connectors.disconnectDiscord();
    }

    /** Start a pull-sync job for a connection. */
    async syncConnector(params: SyncConnectorParams): Promise<TaskSyncJobDto> {
        return this.sync.syncConnector(params);
    }

    /** Get the status of a sync job. */
    async getSyncJob(params: GetSyncJobParams): Promise<TaskSyncJobDto> {
        return this.sync.getSyncJob(params);
    }

    /** Cancel a sync job. */
    async cancelSyncJob(params: CancelSyncJobParams): Promise<void> {
        await this.sync.cancelSyncJob(params);
    }

    /** Get the current user's profile. */
    async getMe(): Promise<UserDto> {
        return this.users.getMe();
    }

    /** Update the current user's profile. */
    async updateMe(params: UpdateMeParams): Promise<UserDto> {
        return this.users.updateMe(params);
    }

    /** Permanently delete the current user's account. */
    async deleteMe(): Promise<void> {
        await this.users.deleteMe();
    }

    /** Generate a full data export. Returns metadata for the created files. */
    async exportData(): Promise<ExportResponseDto> {
        return this.dataPortability.exportData();
    }

    /** Download a single export file as a Blob. */
    async downloadExportFile(params: DownloadExportFileParams): Promise<Blob> {
        return this.dataPortability.downloadExportFile(params);
    }

    /** Import user data from one or more export files. */
    async importData(params: ImportDataParams): Promise<ImportResponseDto> {
        return this.dataPortability.importData(params);
    }

    /** List in-app notifications for the current user. */
    async listNotifications(params: ListNotificationsParams = {}): Promise<NotificationDto[]> {
        return this.notifications.listNotifications(params);
    }

    /** Mark a single notification as read. */
    async markNotificationRead(params: MarkNotificationReadParams): Promise<MarkReadResultDto> {
        return this.notifications.markNotificationRead(params);
    }

    /** Mark all notifications as read. */
    async markAllNotificationsRead(): Promise<MarkAllReadResultDto> {
        return this.notifications.markAllNotificationsRead();
    }

    /** Get notification preferences for the current user. */
    async getNotificationPreferences(): Promise<NotificationPreferencesDto> {
        return this.notifications.getNotificationPreferences();
    }

    /** Update notification preferences (partial). */
    async updateNotificationPreferences(
        params: UpdateNotificationPreferencesParams,
    ): Promise<NotificationPreferencesDto> {
        return this.notifications.updateNotificationPreferences(params);
    }

    /** Send a test notification via a channel (e.g. 'discord'). */
    async testNotificationChannel(params: TestNotificationChannelParams): Promise<TestChannelResultDto> {
        return this.notifications.testNotificationChannel(params);
    }

    /** Fetch public client configuration, such as the advertised MCP server URL. */
    async getAppConfig(): Promise<AppConfigDto> {
        return this.appConfig.getAppConfig();
    }
}
