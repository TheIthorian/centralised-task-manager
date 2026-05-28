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

/** Vague deadline classification with optional reminder cadence. */
export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

/** A single point-in-time reminder attached to a task. */
export type ReminderDto = {
    remindAt: string;        // ISO datetime
    firedAt: string | null;  // set once the notification has been sent
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
    parentId?: string | null;
    fuzzyDeadline?: FuzzyDeadlineInfo | null;
    reminders: ReminderDto[];
    dueDateNotifiedAt: string | null;
    completed: boolean;
    source: string;
    sourceId: string;
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
    parentId?: string;
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

/** Response after updating a connector config. */
export type UpdateConnectorResponseDto = {
    id: string;
    enabled: boolean;
};

/** Connection status for a single task source connector. */
export type ConnectorStatusDto = {
    source: string;
    connected: boolean;
    lastSynced?: string;
    connectorType: ConnectorType;
    connectionSchema: Record<string, unknown>;
    /** True when the connector is connected but required connection details (e.g. databaseId) have not been saved yet. */
    setupRequired: boolean;
};

/** Health-check result for a single connected task-sync connector. */
export type ConnectorHealthDto = {
    source: string;
    healthy: boolean;
    error?: string;
};

/** Status snapshot of a background task-sync job. */
export type TaskSyncJobDto = {
    id: string;
    type: string;
    status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
    source: string;
    stage: 'fetching' | 'upserting' | null;
    synced: number;
    skipped: number;
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
    refreshToken: string;
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
    data: NotificationData;
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

/** A long-lived API token record (raw token value not included). */
export type ApiTokenDto = {
    id: string;
    label: string;
    lastUsedAt: string | null;
};

/** Response after creating a long-lived API token. Raw token shown once. */
export type CreatedApiTokenDto = {
    id: string;
    label: string;
    token: string;
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
};
