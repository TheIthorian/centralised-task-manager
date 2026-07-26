import type {
    CreateTaskDto,
    ListTasksParams,
    RelationType,
    SetFuzzyDeadlineDto,
    SetTaskStatusDto,
    UpdateTaskDto,
    UpdateUserDto,
} from '@ctm/api-client';

/** Access token returned by the auth endpoints. The refresh token lives in an HttpOnly cookie. */
export type WebAuthTokens = {
    accessToken: string | null;
};

/** Normalized API error surfaced to UI consumers. */
export type WebApiError = {
    statusCode: number;
    code: 'unauthorized' | 'forbidden' | 'validation' | 'server' | 'network' | 'unknown';
    message: string;
    cause?: unknown;
};

/** Constructor options for {@link WebApiClient}. */
export type WebApiClientOptions = {
    baseUrl: string;
    accessToken: string | null;
    /** Called whenever tokens are refreshed so the caller can persist them. */
    onTokens: (tokens: WebAuthTokens) => void;
    /** Called when the session is no longer valid (redirect to login). */
    onUnauthorized: () => void;
    /** Called on non-auth errors so the caller can show a toast. */
    onError: (error: WebApiError) => void;
};

export type WebLoginParams = {
    email: string;
    password: string;
};

export type WebRegisterParams = {
    name: string;
    email: string;
    password: string;
};

export type WebListTasksParams = ListTasksParams;

export type WebCreateTaskParams = {
    dto: CreateTaskDto;
};

export type WebUpdateTaskParams = {
    id: string;
    dto: UpdateTaskDto;
};

export type WebSetTaskStatusParams = {
    id: string;
    dto: SetTaskStatusDto;
};

export type WebSetFuzzyDeadlineParams = {
    id: string;
    dto: SetFuzzyDeadlineDto;
};

export type WebRemoveFuzzyDeadlineParams = {
    id: string;
};

export type WebDeleteTaskParams = {
    id: string;
};

export type WebConnectorParams = {
    source: string;
};

export type WebUpdateMeParams = {
    dto: UpdateUserDto;
};

export type WebSyncConnectorParams = {
    connectionId: string;
};

export type WebGetSyncJobParams = {
    connectionId: string;
    jobId: string;
};

export type WebCancelSyncJobParams = {
    connectionId: string;
    jobId: string;
};

export type WebAddReminderParams = {
    id: string;
    dto: { remindAt: string };
};

export type WebRemoveReminderParams = {
    id: string;
    index: number;
};

export type WebRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};

export type WebDownloadExportFileParams = {
    exportId: string;
    filename: string;
};

export type WebImportDataParams = {
    files: Blob[];
    onConflict: 'replace' | 'ignore';
};
