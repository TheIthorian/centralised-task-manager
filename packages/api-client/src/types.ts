/** ISO date string with optional timezone and recurrence rule. */
export type DueDate = {
    date: string;
    timezone: string | null;
    recurrence: string | null;
};

/** Time estimate for a task. */
export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

/** The kind of relation from one task to another. */
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

/** A typed link from one task to another. */
export type TaskRelationDto = {
    type: RelationType;
    targetTaskId: string;
};

/** Vague deadline classification with optional reminder cadence. */
export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

/** A single point-in-time reminder attached to a task. */
export type ReminderDto = {
    remindAt: string; // ISO datetime
    firedAt: string | null; // set once the notification has been sent
};

/** Authenticated user representation. */
export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

/** Physical or virtual location attached to a task. */
export type LocationDto = {
    name: string;
    googleMapsUrl: string;
};

/** Full task representation returned by the API. */
export type TaskDto = {
    id: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4 | null;
    due?: DueDate | null;
    deadlineDate?: string | null;
    duration?: Duration | null;
    relations: TaskRelationDto[];
    fuzzyDeadline?: FuzzyDeadlineInfo | null;
    reminders: ReminderDto[];
    dueDateNotifiedAt: string | null;
    completed: boolean;
    source: string;
    sourceId: string;
    externalAccountId: string | null;
    tags: string[];
    locations: LocationDto[];
    createdAt: string;
    updatedAt: string;
};

/** Payload for creating a new task. */
export type CreateTaskDto = {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    source: string;
    locations?: LocationDto[];
};

/** Partial payload for updating an existing task. */
export type UpdateTaskDto = {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    tags?: string[];
    locations?: LocationDto[];
};

/** Payload for changing a task's open/done status. */
export type SetTaskStatusDto = {
    status: 'open' | 'done';
};

/** Payload for setting a fuzzy deadline on a task. */
export type SetFuzzyDeadlineDto = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery?: 'daily' | 'weekly';
};

/** Body for adding a reminder to a task. */
export type AddReminderDto = {
    remindAt: string; // ISO datetime
};

export enum ConnectorType {
    TaskSync = 'task_sync',
    Notification = 'notification',
}

/** Stored connector config for a connected source. */
export type ConnectorConfigDto = {
    id: string;
    source: string;
    enabled: boolean;
    lastSyncedAt?: string;
    lastError?: string;
};

/** OAuth redirect URL for initiating a connector auth flow. */
export type ConnectorAuthUrlDto = {
    url: string;
};

/** A Notion database available to the connected integration. */
export type NotionDatabaseDto = {
    id: string;
    name: string;
};

/** Generic ok/success response. */
export type OkDto = {
    ok: boolean;
};

/** Connector-specific connection details payload (e.g. Notion database ID). */
export type ConnectorDetailsDto = Record<string, unknown>;

/** Response after updating a connector config. */
export type UpdateConnectorResponseDto = {
    id: string;
    enabled: boolean;
};

/** One connected external account under a source. */
export type ConnectorAccountDto = {
    connectionId: string;
    externalAccountId: string;
    email: string | null;
    label: string | null;
    lastSynced?: string;
    setupRequired: boolean;
};

/** Connection status for a single task source connector (now multi-account). */
export type ConnectorStatusDto = {
    source: string;
    connectorType: ConnectorType;
    connectionSchema: Record<string, unknown>;
    accounts: ConnectorAccountDto[];
};

/** Health-check result for a single connected task-sync connection. */
export type ConnectorHealthDto = {
    source: string;
    connectionId: string;
    healthy: boolean;
    error?: string;
};

/** Status snapshot of a background task-sync job. */
export type TaskSyncJobDto = {
    id: string;
    type: string;
    status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
    source: string;
    connectionId: string;
    stage: 'fetching' | 'upserting' | null;
    synced: number;
    skipped: number;
    /** Remote tasks left unimported because the account hit its task cap. */
    droppedOverQuota: number;
    error: string | null;
    completedAt: string | null;
};

/** Partial payload for updating the current user's profile. */
export type UpdateUserDto = {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
};

/** Access/refresh token pair returned after login or refresh. */
export type TokenPair = {
    accessToken: string;
    /** Lifetime of `accessToken` in seconds, so clients can refresh before it expires. */
    expiresIn: number;
    /** Omitted for web clients — the refresh token is returned as an HttpOnly cookie instead. */
    refreshToken?: string;
    user: UserDto;
};

/** Named preset filter for the task list endpoint. */
export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';

/** Discriminated union of notification event types. */
export type NotificationType = 'connector_reconnect' | 'daily_summary' | 'reminder' | 'upcoming_deadline';

/** Type-safe payload carried by each notification type. */
export type NotificationData =
    | { type: 'reminder'; taskId?: string }
    | { type: 'upcoming_deadline' }
    | { type: 'connector_reconnect'; source?: string }
    | { type: 'daily_summary' };

/** A single in-app notification. */
export type NotificationDto = {
    id: string;
    type: NotificationType;
    data: NotificationData | null;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
};

/** Per-channel delivery flags for a notification type. */
export type ChannelPrefsDto = {
    inApp: boolean;
    discord: boolean;
    email: boolean;
};

/** Full notification preferences for the current user. */
export type NotificationPreferencesDto = {
    connectorReconnect: ChannelPrefsDto;
    dailySummary: ChannelPrefsDto;
    reminder: ChannelPrefsDto;
    upcomingDeadline: ChannelPrefsDto;
};

/** Partial update for per-channel delivery flags. */
export type UpdateChannelPrefsDto = {
    inApp?: boolean;
    discord?: boolean;
    email?: boolean;
};

/** Partial update for all notification preferences. */
export type UpdateNotificationPreferencesDto = {
    connectorReconnect?: UpdateChannelPrefsDto;
    dailySummary?: UpdateChannelPrefsDto;
    reminder?: UpdateChannelPrefsDto;
    upcomingDeadline?: UpdateChannelPrefsDto;
};

/** Discord connection status for the current user. */
export type DiscordStatusDto = {
    connected: boolean;
    discordUserId?: string;
};

/** Result of sending a test notification to a channel. */
export type TestChannelResultDto = {
    sent: boolean;
};

/** Result of marking a single notification as read. */
export type MarkReadResultDto = {
    id: string;
    read: boolean;
};

/** Result of marking all notifications as read. */
export type MarkAllReadResultDto = {
    updated: number;
};

/** An OAuth client that a user has authorized. No token data included. */
export type AuthorizedAppDto = {
    clientId: string;
    clientName: string;
    scopes: string[];
    authorizedAt: string;
    type: 'oauth';
};

/** Metadata for a single file persisted to storage (embedded in ExportResponseDto). */
export type StoredFileDto = {
    filename: string;
    sizeBytes: number;
    contentType: string;
    sha256: string;
};

/** Response from POST /users/me/export. */
export type ExportResponseDto = {
    exportId: string;
    files: StoredFileDto[];
};

/** Profile section of an export envelope. */
export type ExportProfileDto = {
    email: string;
    name: string;
    notificationPreferences: NotificationPreferencesDto;
};

/** Task shape used in export envelopes — includes full status (not just `completed`). */
export type ExportTaskDto = {
    id: string;
    source: string;
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done' | 'archived';
    priority: 1 | 2 | 3 | 4 | null;
    tags: string[];
    due: DueDate | null;
    deadlineDate: string | null;
    duration: Duration | null;
    fuzzyDeadline: FuzzyDeadlineInfo | null;
    reminders: ReminderDto[];
    dueDateNotifiedAt: string | null;
    locations: LocationDto[];
    syncedAt: string;
    createdAt: string;
    updatedAt: string;
};

/** The JSON envelope written to each export part file. */
export type ExportEnvelopeDto = {
    version: '1';
    exportedAt: string;
    exportId: string;
    part: number;
    totalParts: number;
    /** Only present in part 1. */
    profile?: ExportProfileDto;
    tasks: ExportTaskDto[];
    notifications: NotificationDto[];
};

/** Request body for POST /users/me/import (multipart form field). */
export type ImportRequestDto = {
    onConflict: 'replace' | 'ignore';
};

export type ImportSummaryDto = {
    tasks: number;
    notifications: number;
};

/** Response from POST /users/me/import. */
export type ImportResponseDto = {
    imported: ImportSummaryDto;
    skipped: ImportSummaryDto;
};

/** Response from GET /config — public client configuration. */
export type AppConfigDto = {
    /** Base URL of the MCP server clients such as Claude should connect to. */
    mcpUrl: string;
};

/** Response from GET /health — service liveness for platform healthchecks. */
export type HealthDto = {
    status: 'ok' | 'degraded';
    /** Mongo connection state; omitted by services that have no database. */
    database?: 'up' | 'down';
    uptimeSeconds: number;
};
