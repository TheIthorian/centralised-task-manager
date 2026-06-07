export type NotificationType = 'connector_reconnect' | 'daily_summary' | 'reminder' | 'upcoming_deadline';

export type NotificationData =
    | { type: 'reminder'; taskId?: string }
    | { type: 'upcoming_deadline' }
    | { type: 'connector_reconnect'; source?: string }
    | { type: 'daily_summary' };

export type SendNotificationDto = {
    userId: string;
    type: NotificationType;
    data: NotificationData;
    title: string;
    body: string;
};
