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

/** Parameters for {@link NotificationsClient.listNotifications}. */
export type ListNotificationsParams = {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
};

/** Parameters for {@link NotificationsClient.markNotificationRead}. */
export type MarkNotificationReadParams = {
    id: string;
};

/** Parameters for {@link NotificationsClient.updateNotificationPreferences}. */
export type UpdateNotificationPreferencesParams = {
    dto: UpdateNotificationPreferencesDto;
};

/** Parameters for {@link NotificationsClient.testNotificationChannel}. */
export type TestNotificationChannelParams = {
    channel: string;
};
