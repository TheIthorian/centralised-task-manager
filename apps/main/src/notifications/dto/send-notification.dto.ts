export type NotificationType =
    | 'connector_reconnect'
    | 'daily_summary'
    | 'reminder'
    | 'upcoming_deadline';

export type SendNotificationDto = {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
};
