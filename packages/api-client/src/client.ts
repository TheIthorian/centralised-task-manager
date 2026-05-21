import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
    ConnectorStatusDto,
    TaskDto,
    TaskFilter,
    TokenPair,
    UserDto,
} from './types.js';
import type {
    ApiClientErrorOptions,
    ApiClientOptions,
    CreateTaskParams,
    DeleteTaskParams,
    DisconnectConnectorParams,
    GetConnectorAuthUrlParams,
    ListTasksParams,
    LoginParams,
    RefreshParams,
    RegisterParams,
    RemoveFuzzyDeadlineParams,
    SetFuzzyDeadlineParams,
    SetTaskStatusParams,
    UpdateMeParams,
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

    /** List tasks, optionally filtered by UI filter. */
    async listTasks({ filter = 'all' }: ListTasksParams = {}): Promise<TaskDto[]> {
        return this.request<TaskDto[]>({
            method: 'GET',
            path: '/tasks',
            params: this.filterToParams(filter),
        });
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

    /** List all connector statuses for the current user. */
    async listConnectors(): Promise<ConnectorStatusDto[]> {
        return this.request<ConnectorStatusDto[]>({ method: 'GET', path: '/connectors' });
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

    private filterToParams(filter: TaskFilter): Record<string, string> {
        switch (filter) {
            case 'done':
                return { status: 'done' };
            case 'today':
            case 'upcoming':
                return { status: 'open' };
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
