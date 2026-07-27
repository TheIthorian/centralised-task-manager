import { ApiProperty } from '@nestjs/swagger';
import type {
    ChannelPrefsDto as IChannelPrefsDto,
    MarkAllReadResultDto as IMarkAllReadResultDto,
    MarkReadResultDto as IMarkReadResultDto,
    NotificationData,
    NotificationDto as INotificationDto,
    NotificationPreferencesDto as INotificationPreferencesDto,
    NotificationType,
    TestChannelResultDto as ITestChannelResultDto,
} from '@ctm/api-client';

const NOTIFICATION_TYPES: NotificationType[] = [
    'connector_reconnect',
    'daily_summary',
    'reminder',
    'upcoming_deadline',
];

/** A single in-app notification. */
export class NotificationDto implements INotificationDto {
    id!: string;

    @ApiProperty({ enum: NOTIFICATION_TYPES })
    type!: NotificationType;

    /** Type-specific payload — shape depends on `type`. */
    @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
    data!: NotificationData | null;

    title!: string;
    body!: string;
    read!: boolean;
    createdAt!: string;
}

/** Per-channel delivery flags for a notification type. */
export class ChannelPrefsDto implements IChannelPrefsDto {
    inApp!: boolean;
    discord!: boolean;
    email!: boolean;
}

/** Full notification preferences for the current user. */
export class NotificationPreferencesDto implements INotificationPreferencesDto {
    connectorReconnect!: ChannelPrefsDto;
    dailySummary!: ChannelPrefsDto;
    reminder!: ChannelPrefsDto;
    upcomingDeadline!: ChannelPrefsDto;
}

/** Result of sending a test notification to a channel. */
export class TestChannelResultDto implements ITestChannelResultDto {
    sent!: boolean;
}

/** Result of marking a single notification as read. */
export class MarkReadResultDto implements IMarkReadResultDto {
    id!: string;
    read!: boolean;
}

/** Result of marking all notifications as read. */
export class MarkAllReadResultDto implements IMarkAllReadResultDto {
    updated!: number;
}
