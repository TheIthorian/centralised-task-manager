import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import type { NotificationDto } from '@ctm/api-client';
import type { WebApiClient } from '../api/web-api-client.js';

/**
 * Subscribe to real-time notification events from the server via Socket.IO.
 * Prepends incoming notifications to the ['notifications'] React Query cache
 * so UI updates without a poll cycle.
 */
export function useNotificationSocket(api: WebApiClient): void {
    const qc = useQueryClient();

    useEffect(() => {
        const token = api.getAccessToken();

        if (!token) return;

        const baseUrl = api.getBaseUrl();

        const socket = io(`${baseUrl}/notifications`, {
            transports: ['websocket'],
            auth: { token },
        });

        socket.on('notification', (notification: NotificationDto) => {
            qc.setQueryData<NotificationDto[]>(['notifications'], (prev = []) => [notification, ...prev]);
        });

        return () => {
            socket.disconnect();
        };
    }, [api, qc]);
}
