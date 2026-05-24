import type {
    CreateTaskDto,
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
export type LoginParams = {
    email: string;
    password: string;
};

/** Parameters for {@link CtmApiClient.register}. */
export type RegisterParams = {
    name: string;
    email: string;
    password: string;
};

/** Parameters for {@link CtmApiClient.refresh}. Omit to use the token passed to the constructor. */
export type RefreshParams = {
    refreshToken?: string;
};

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
};

/** Parameters for {@link CtmApiClient.getConnectorAuthUrl}. */
export type GetConnectorAuthUrlParams = {
    source: string;
};

/** Parameters for {@link CtmApiClient.disconnectConnector}. */
export type DisconnectConnectorParams = {
    source: string;
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
    source: string;
};

/** Parameters for {@link CtmApiClient.getSyncJob}. */
export type GetSyncJobParams = {
    source: string;
    jobId: string;
};

/** Parameters for {@link CtmApiClient.cancelSyncJob}. */
export type CancelSyncJobParams = {
    source: string;
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
    source: string;
    details: Record<string, unknown>;
};

/** Options for constructing an {@link ApiClientError}. */
export type ApiClientErrorOptions = {
    message: string;
    statusCode: number;
    method: string;
    path: string;
    responseBody?: unknown;
};
