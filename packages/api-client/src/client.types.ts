import type {
    AddReminderDto,
    ConnectorDetailsDto,
    CreateTaskDto,
    LoginDto,
    RefreshDto,
    RegisterDto,
    RelationType,
    SetFuzzyDeadlineDto,
    SetTaskStatusDto,
    TaskFilter,
    UpdateNotificationPreferencesDto,
    UpdateTaskDto,
    UpdateUserDto,
} from './types.js';

/** Options for constructing a {@link CtmApiClient} instance. */
export type ApiClientOptions = {
    baseUrl: string;
    accessToken?: string | null;
    refreshToken?: string | null;
};

/** Parameters for {@link CtmApiClient.login}. */
export type LoginParams = LoginDto;

/** Parameters for {@link CtmApiClient.register}. */
export type RegisterParams = RegisterDto;

/** Parameters for {@link CtmApiClient.refresh}. Omit to use the token passed to the constructor. */
export type RefreshParams = RefreshDto;

/** Parameters for {@link CtmApiClient.updateTask}. */
export type UpdateTaskParams = {
    id: string;
    dto: UpdateTaskDto;
};

/** Parameters for {@link CtmApiClient.createTask}. */
export type CreateTaskParams = {
    dto: CreateTaskDto;
};

/** Parameters for {@link CtmApiClient.deleteTask}. */
export type DeleteTaskParams = {
    id: string;
};

/** Parameters for {@link CtmApiClient.setFuzzyDeadline}. */
export type SetFuzzyDeadlineParams = {
    id: string;
    dto: SetFuzzyDeadlineDto;
};

/** Parameters for {@link CtmApiClient.listTasks}. */
export type ListTasksParams = {
    filter?: TaskFilter;
    /** ISO date string — only return tasks updated on or after this date. */
    lastUpdatedFromDate?: string;
    /** Page number (1-based). */
    page?: number;
    /** Number of tasks per page. */
    limit?: number;
    /** Filter by status directly (alternative to `filter` preset). */
    status?: 'open' | 'done' | 'archived';
    /** ISO date string — only tasks where due.date < dueBefore. Must not be combined with the `filter` preset. */
    dueBefore?: string;
    /** ISO date string — only tasks where due.date >= dueAfter. Must not be combined with the `filter` preset. */
    dueAfter?: string;
    /** When true, only return tasks with no due date. */
    noDate?: boolean;
};

/** Parameters for {@link CtmApiClient.getConnectorAuthUrl}. */
export type GetConnectorAuthUrlParams = {
    source: string;
};

/** Parameters for {@link CtmApiClient.disconnectConnector}. */
export type DisconnectConnectorParams = {
    connectionId: string;
};

/** Parameters for {@link CtmApiClient.updateMe}. */
export type UpdateMeParams = {
    dto: UpdateUserDto;
};

/** Parameters for {@link CtmApiClient.setTaskStatus}. */
export type SetTaskStatusParams = {
    id: string;
    dto: SetTaskStatusDto;
};

/** Parameters for {@link CtmApiClient.removeFuzzyDeadline}. */
export type RemoveFuzzyDeadlineParams = {
    id: string;
};

/** Parameters for {@link CtmApiClient.syncConnector}. */
export type SyncConnectorParams = {
    connectionId: string;
};

/** Parameters for {@link CtmApiClient.getSyncJob}. */
export type GetSyncJobParams = {
    connectionId: string;
    jobId: string;
};

/** Parameters for {@link CtmApiClient.cancelSyncJob}. */
export type CancelSyncJobParams = {
    connectionId: string;
    jobId: string;
};

/** Parameters for {@link CtmApiClient.listNotifications}. */
export type ListNotificationsParams = {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
};

/** Parameters for {@link CtmApiClient.markNotificationRead}. */
export type MarkNotificationReadParams = {
    id: string;
};

/** Parameters for {@link CtmApiClient.updateNotificationPreferences}. */
export type UpdateNotificationPreferencesParams = {
    dto: UpdateNotificationPreferencesDto;
};

/** Parameters for {@link CtmApiClient.setConnectionDetails}. */
export type SetConnectionDetailsParams = {
    connectionId: string;
    details: ConnectorDetailsDto;
};

/** Parameters for {@link CtmApiClient.listNotionDatabases}. */
export type ListNotionDatabasesParams = {
    connectionId: string;
};

/** Parameters for {@link CtmApiClient.addRelation}. */
export type AddRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};

/** Parameters for {@link CtmApiClient.removeRelation}. */
export type RemoveRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};

/** Options for constructing an {@link ApiClientError}. */
export type ApiClientErrorOptions = {
    message: string;
    statusCode: number;
    method: string;
    path: string;
    responseBody?: unknown;
    retryAfterSeconds?: number;
};

/** Parameters for {@link CtmApiClient.getTask}. */
export type GetTaskParams = {
    id: string;
};

/** Parameters for {@link CtmApiClient.addReminder}. */
export type AddReminderParams = {
    id: string;
    dto: AddReminderDto;
};

/** Parameters for {@link CtmApiClient.removeReminder}. */
export type RemoveReminderParams = {
    id: string;
    index: number;
};

/** Parameters for {@link CtmApiClient.revokeAuthorizedApp}. */
export type RevokeAuthorizedAppParams = {
    clientId: string;
};

/** Parameters for {@link CtmApiClient.downloadExportFile}. */
export type DownloadExportFileParams = {
    exportId: string;
    filename: string;
};

/** Parameters for {@link CtmApiClient.importData}. */
export type ImportDataParams = {
    files: Blob[];
    onConflict: 'replace' | 'ignore';
};
