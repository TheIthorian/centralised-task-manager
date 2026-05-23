/** A task's due date with optional timezone and recurrence rule (RRULE format). */
export type DueDate = {
    date: Date;
    timezone: string | null;
    recurrence: string | null;
};

/** A time duration expressed as an amount and unit. */
export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

/** A normalised task representation returned by any connector. */
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

/** OAuth2 token set stored per connected user. */
export type OAuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
};

/** Payload for creating a new remote task. */
export type CreateTaskDto = {
    title: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

/** Partial update payload for an existing remote task. */
export type UpdateTaskDto = {
    title?: string;
    description?: string;
    due?: { date: Date; timezone?: string; recurrence?: string };
    deadlineDate?: Date;
    duration?: Duration;
    priority?: number;
};

/** Contract that every task-source connector must implement. */
export type TaskConnector = {
    /** Unique identifier for the task source (e.g. `"todoist"`, `"google_tasks"`). */
    readonly source: string;
    /** Build the OAuth authorization URL for the given user state value. */
    getAuthUrl(userId: string): string;
    /** Exchange an OAuth authorization code for a token set. */
    exchangeCode(code: string): Promise<OAuthTokens>;
    /** Refresh an expired access token using the stored refresh token. */
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    /** Fetch all tasks accessible with the given token set. */
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    /** Create a new task and return the created representation. */
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    /** Apply a partial update to an existing task and return the updated representation. */
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    /** Mark a task as complete. */
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    /** Permanently delete a task. */
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
};
