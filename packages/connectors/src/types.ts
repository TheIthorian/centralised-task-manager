export interface RemoteTask {
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done';
    priority: number | null;
    dueDate: Date | null;
    tags: string[];
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    dueDate?: Date;
    priority?: number;
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    dueDate?: Date;
    priority?: number;
}

export interface TaskConnector {
    readonly source: string;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
}
