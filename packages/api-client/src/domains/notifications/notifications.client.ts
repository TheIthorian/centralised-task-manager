import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type {
    ListNotificationsParams,
    MarkAllReadResultDto,
    MarkNotificationReadParams,
    MarkReadResultDto,
    NotificationDto,
    NotificationPreferencesDto,
    TestChannelResultDto,
    TestNotificationChannelParams,
    UpdateNotificationPreferencesParams,
} from './notifications.types.js';

/** In-app notifications and the per-channel delivery preferences behind them. */
export class NotificationsClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** List in-app notifications for the current user. */
    async listNotifications({ page = 1, limit = 20, unreadOnly = false }: ListNotificationsParams = {}): Promise<
        NotificationDto[]
    > {
        return this.http.request<NotificationDto[]>({
            method: 'GET',
            path: '/notifications',
            params: { page: String(page), limit: String(limit), unreadOnly: String(unreadOnly) },
        });
    }

    /** Mark a single notification as read. */
    async markNotificationRead({ id }: MarkNotificationReadParams): Promise<MarkReadResultDto> {
        return this.http.request<MarkReadResultDto>({ method: 'PATCH', path: `/notifications/${id}/read` });
    }

    /** Mark all notifications as read. */
    async markAllNotificationsRead(): Promise<MarkAllReadResultDto> {
        return this.http.request<MarkAllReadResultDto>({ method: 'PATCH', path: '/notifications/read-all' });
    }

    /** Get notification preferences for the current user. */
    async getNotificationPreferences(): Promise<NotificationPreferencesDto> {
        return this.http.request<NotificationPreferencesDto>({ method: 'GET', path: '/notifications/preferences' });
    }

    /** Update notification preferences (partial). */
    async updateNotificationPreferences({
        dto,
    }: UpdateNotificationPreferencesParams): Promise<NotificationPreferencesDto> {
        return this.http.request<NotificationPreferencesDto>({
            method: 'PATCH',
            path: '/notifications/preferences',
            body: dto,
        });
    }

    /** Send a test notification via a channel (e.g. 'discord'). */
    async testNotificationChannel({ channel }: TestNotificationChannelParams): Promise<TestChannelResultDto> {
        return this.http.request<TestChannelResultDto>({
            method: 'POST',
            path: `/notifications/channels/${channel}/test`,
        });
    }
}
