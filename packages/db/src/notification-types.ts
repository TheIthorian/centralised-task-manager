/** The trigger a notification was raised by. */
export type NotificationType = 'connector_reconnect' | 'daily_summary' | 'reminder' | 'upcoming_deadline';

/** Trigger-specific payload stored alongside a notification. */
export type NotificationData =
    | { type: 'reminder'; taskId?: string }
    | { type: 'upcoming_deadline' }
    | { type: 'connector_reconnect'; source?: string }
    | { type: 'daily_summary' };
