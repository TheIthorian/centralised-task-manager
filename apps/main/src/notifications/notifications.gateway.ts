import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { NotificationDto } from '@ctm/api-client';

/** Socket.IO gateway that pushes real-time notifications to connected web clients. */
@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private readonly server!: Server;

    private readonly logger = new Logger(NotificationsGateway.name);

    /** userId → set of connected socket IDs (one user may have multiple tabs). */
    private readonly userSockets = new Map<string, Set<string>>();

    constructor(private readonly jwtService: JwtService) {}

    /** Authenticate the socket via the JWT passed in handshake auth. */
    handleConnection(socket: Socket): void {
        const token = socket.handshake.auth['token'] as string | undefined;

        if (!token) {
            socket.disconnect();
            return;
        }

        try {
            const payload = this.jwtService.verify<{ sub: string }>(token);
            const userId = payload.sub;

            socket.data['userId'] = userId;

            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }

            this.userSockets.get(userId)!.add(socket.id);
            this.logger.debug(`Socket connected: userId=${userId} socketId=${socket.id}`);
        } catch {
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket): void {
        const userId = socket.data['userId'] as string | undefined;

        if (!userId) return;

        const sockets = this.userSockets.get(userId);

        if (sockets) {
            sockets.delete(socket.id);

            if (sockets.size === 0) {
                this.userSockets.delete(userId);
            }
        }

        this.logger.debug(`Socket disconnected: userId=${userId} socketId=${socket.id}`);
    }

    /** Emit a notification event to all sockets belonging to the given user. */
    sendNotification({ userId, notification }: { userId: string; notification: NotificationDto }): void {
        const socketIds = this.userSockets.get(userId);

        if (!socketIds || socketIds.size === 0) return;

        for (const socketId of socketIds) {
            this.server.to(socketId).emit('notification', notification);
        }
    }
}
