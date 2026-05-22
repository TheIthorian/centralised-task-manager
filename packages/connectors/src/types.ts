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

export type TaskConnector = {
    readonly source: string;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
};
