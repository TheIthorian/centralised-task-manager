import type { CreateTaskDto, TaskFilter, UpdateTaskDto, UpdateUserDto } from '@ctm/api-client';
import type { StoredAuthTokens } from '../auth/auth-storage.js';

export type WebApiError = {
    statusCode: number;
    code: 'unauthorized' | 'forbidden' | 'validation' | 'server' | 'network' | 'unknown';
    message: string;
    cause?: unknown;
};

export type WebApiClientOptions = {
    baseUrl: string;
    accessToken: string | null;
    refreshToken: string | null;
    onTokens: (tokens: StoredAuthTokens) => void;
    onUnauthorized: () => void;
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
};

export type WebCreateTaskParams = {
    dto: CreateTaskDto;
};

export type WebUpdateTaskParams = {
    id: string;
    dto: UpdateTaskDto;
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
