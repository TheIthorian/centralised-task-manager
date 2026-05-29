import type {
    CreateTaskDto,
    SetFuzzyDeadlineDto,
    SetTaskStatusDto,
    TaskFilter,
    UpdateTaskDto,
    UpdateUserDto,
} from '@ctm/api-client';
import type { StoredAuthTokens } from '../auth/auth-storage.js';

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
    refreshToken: string | null;
    /** Called whenever tokens are refreshed so the caller can persist them. */
    onTokens: (tokens: StoredAuthTokens) => void;
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

export type WebListTasksParams = {
    filter?: TaskFilter;
    lastUpdatedFromDate?: string;
};

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
    source: string;
};

export type WebGetSyncJobParams = {
    source: string;
    jobId: string;
};

export type WebCancelSyncJobParams = {
    source: string;
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
