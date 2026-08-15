import type { NotificationData, NotificationType } from '@ctm/db';

export type { NotificationData, NotificationType };

export type SendNotificationDto = {
    userId: string;
    type: NotificationType;
    data: NotificationData;
    title: string;
    body: string;
};
