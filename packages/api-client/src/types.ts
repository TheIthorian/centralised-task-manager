export type DueDate = {
    date: string;
    timezone: string | null;
    recurrence: string | null;
};

export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

export type LocationDto = {
    name: string;
    googleMapsUrl: string;
};

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
    completed: boolean;
    source: string;
    sourceId: string;
    tags: string[];
    locations: LocationDto[];
    createdAt: string;
    updatedAt: string;
};

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

export type SetTaskStatusDto = {
    status: 'open' | 'done';
};

export type SetFuzzyDeadlineDto = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery?: 'daily' | 'weekly';
};

export type ConnectorStatusDto = {
    source: string;
    connected: boolean;
    lastSynced?: string;
};

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

export type UpdateUserDto = {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
};

export type TokenPair = {
    accessToken: string;
    refreshToken: string;
    user: UserDto;
};

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';

export type NotificationType = 'connector_reconnect' | 'daily_summary' | 'reminder' | 'upcoming_deadline';

export type NotificationDto = {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
};

export type ChannelPrefsDto = {
    inApp: boolean;
    discord: boolean;
    email: boolean;
};

export type NotificationPreferencesDto = {
    connectorReconnect: ChannelPrefsDto;
    dailySummary: ChannelPrefsDto;
    reminder: ChannelPrefsDto;
    upcomingDeadline: ChannelPrefsDto;
};

export type UpdateChannelPrefsDto = {
    inApp?: boolean;
    discord?: boolean;
    email?: boolean;
};

export type UpdateNotificationPreferencesDto = {
    connectorReconnect?: UpdateChannelPrefsDto;
    dailySummary?: UpdateChannelPrefsDto;
    reminder?: UpdateChannelPrefsDto;
    upcomingDeadline?: UpdateChannelPrefsDto;
};

export type DiscordStatusDto = {
    connected: boolean;
    discordUserId?: string;
};
