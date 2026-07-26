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

        // Namespace, not just transport path — socket.io derives the namespace from the
        // URI's pathname. With a same-origin `/api` base, `io(\`${baseUrl}/notifications\`)`
        // would ask for namespace `/api/notifications`, which the server does not
        // declare (the gateway is on `/notifications`). Passing the namespace alone
        // resolves against the current origin, giving the correct namespace while
        // `path` still carries the handshake through the proxy.
        const socket = io('/notifications', {
            path: '/api/socket.io',
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
