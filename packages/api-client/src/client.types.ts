import type { CreateTaskDto, SetFuzzyDeadlineDto, SetTaskStatusDto, TaskFilter, UpdateTaskDto, UpdateUserDto } from './types.js';

export type ApiClientOptions = {
    baseUrl: string;
    accessToken?: string | null;
    refreshToken?: string | null;
};

export type LoginParams = {
    email: string;
    password: string;
};

export type RegisterParams = {
    name: string;
    email: string;
    password: string;
};

export type RefreshParams = {
    refreshToken?: string;
};

export type UpdateTaskParams = {
    id: string;
    dto: UpdateTaskDto;
};

export type CreateTaskParams = {
    dto: CreateTaskDto;
};

export type DeleteTaskParams = {
    id: string;
};

export type SetFuzzyDeadlineParams = {
    id: string;
    dto: SetFuzzyDeadlineDto;
};

export type ListTasksParams = {
    filter?: TaskFilter;
};

export type GetConnectorAuthUrlParams = {
    source: string;
};

export type DisconnectConnectorParams = {
    source: string;
};

export type UpdateMeParams = {
    dto: UpdateUserDto;
};

export type SetTaskStatusParams = {
    id: string;
    dto: SetTaskStatusDto;
};

export type RemoveFuzzyDeadlineParams = {
    id: string;
};

export type SyncConnectorParams = {
    source: string;
};

export type GetSyncJobParams = {
    source: string;
    jobId: string;
};

export type CancelSyncJobParams = {
    source: string;
    jobId: string;
};

export type ApiClientErrorOptions = {
    message: string;
    statusCode: number;
    method: string;
    path: string;
    responseBody?: unknown;
};
