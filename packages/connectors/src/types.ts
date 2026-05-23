export type DueDate = {
    date: Date;
    timezone: string | null;
    recurrence: string | null;
};

export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

export type RemoteTask = {
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done';
    priority: number | null;
    due: DueDate | null;
    deadline: Date | null;
    duration: Duration | null;
    parentSourceId: string | null;
    tags: string[];
};

export type OAuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
};

export type CreateTaskDto = {
    title: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

export type UpdateTaskDto = {
    title?: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

export type ConnectionField =
    | { type: 'text'; label: string; required?: boolean }
    | { type: 'remote_select'; label: string; required?: boolean; endpoint: string };

export type ConnectionDetailsSchema = Record<string, ConnectionField>;

export type TaskConnector = {
    readonly source: string;
    readonly connectionDetailsSchema?: ConnectionDetailsSchema;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens, connectionDetails?: Record<string, unknown>): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto, connectionDetails?: Record<string, unknown>): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto, connectionDetails?: Record<string, unknown>): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
};
