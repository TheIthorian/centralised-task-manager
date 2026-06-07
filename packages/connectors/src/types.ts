/** All supported connector names (OAuth participants). */
export enum ConnectorName {
    Todoist = 'todoist',
    GoogleTasks = 'google_tasks',
    Notion = 'notion',
    Discord = 'discord',
}

/** Categorises what a connector is used for. */
export enum ConnectorType {
    TaskSync = 'task_sync',
    Notification = 'notification',
}

/** Connector names that sync tasks (excludes notification-only connectors like Discord). */
export enum TaskConnectorName {
    Todoist = 'todoist',
    GoogleTasks = 'google_tasks',
    Notion = 'notion',
}

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

/** Identity of a single connected external account. */
export type AccountIdentity = {
    /** Provider's stable account id. Used as the per-account key. */
    externalAccountId: string;
    /** Account email, when the provider exposes one. */
    email?: string;
    /** Human-friendly label (e.g. a Notion workspace name) when no email. */
    label?: string;
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

export type ConnectionField =
    | { type: 'text'; label: string; required?: boolean }
    | { type: 'remote_select'; label: string; required?: boolean; endpoint: string };

export type ConnectionDetailsSchema = Record<
    string,
    {
        inputDefinition: ConnectionField;
        /** AJV-compatible JSON Schema for validating this field's value. */
        validationSchema: { type: string; [key: string]: unknown };
    }
>;

/** Extra fields to merge into ConnectorConfig after a successful OAuth callback. */
export type ConnectionSettings = {
    settings?: Record<string, unknown>;
};

/** OAuth2 flow contract for connectors that authenticate via OAuth. */
export type OAuthConnector = {
    readonly name: ConnectorName;
    readonly connectorType: ConnectorType;
    /** Optional schema describing per-user connection fields (e.g. notion database picker). */
    readonly connectionDetailsSchema: ConnectionDetailsSchema;
    /** Probe the provider API with the given tokens to verify the connection is healthy. */
    healthCheck(tokens: OAuthTokens, connectionDetails?: Record<string, unknown>): Promise<HealthCheckResult>;
    /** Build the OAuth authorization URL for the given user state value. */
    getAuthUrl(userId: string): string;
    /** Exchange an OAuth authorization code for a token set. */
    exchangeCode(code: string): Promise<OAuthTokens>;
    /** Refresh an expired access token using the stored refresh token. */
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    /** Optionally resolve extra settings to persist after a successful OAuth callback. */
    resolveConnectionSettings?(tokens: OAuthTokens): Promise<ConnectionSettings>;
    /** Resolve the external account identity for a freshly-connected token set. */
    resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity>;
};

/** Result of a connector health probe. */
export type HealthCheckResult = {
    source: ConnectorName;
    healthy: boolean;
    error?: string;
};

/** Task CRUD contract for connectors that read and write remote tasks. */
export type ExternalTaskSource = {
    readonly name: TaskConnectorName;
    /** Fetch all tasks accessible with the given token set. */
    fetchTasks(tokens: OAuthTokens, connectionDetails?: Record<string, unknown>): Promise<RemoteTask[]>;
    /** Create a new task and return the created representation. */
    createTask(
        tokens: OAuthTokens,
        task: CreateTaskDto,
        connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask>;
    /** Apply a partial update to an existing task and return the updated representation. */
    updateTask(
        tokens: OAuthTokens,
        sourceId: string,
        patch: UpdateTaskDto,
        connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask>;
    /** Mark a task as complete. */
    completeTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
    /** Permanently delete a task. */
    deleteTask(tokens: OAuthTokens, sourceId: string, connectionDetails?: Record<string, unknown>): Promise<void>;
};
