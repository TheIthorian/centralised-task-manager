import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { TaskSyncJobDocument } from '../jobs/schemas/task-sync-job.schema.js';
import { toSyncJobDto } from './sync-job.dto.js';

@WebSocketGateway({
    cors: {
        origin: process.env['CORS_ORIGIN'] === '*' || !process.env['CORS_ORIGIN']
            ? true
            : process.env['CORS_ORIGIN']!.split(',').map((o) => o.trim()),
        credentials: !!process.env['CORS_ORIGIN'] && process.env['CORS_ORIGIN'] !== '*',
    },
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private readonly server!: Server;

    private readonly logger = new Logger(SyncGateway.name);

    constructor(private readonly jwt: JwtService) {}

    /** Authenticate the connecting socket via JWT; joins it to a user-scoped room or disconnects. */
    handleConnection(client: Socket): void {
        const token = client.handshake.auth['token'] as string | undefined
            ?? client.handshake.headers['authorization']?.replace('Bearer ', '');

        if (!token) {
            this.logger.warn(`WS connection rejected: no token`);
            client.disconnect();
            return;
        }

        try {
            const payload = this.jwt.verify<{ sub: string }>(token);
            void client.join(`user:${payload.sub}`);
            this.logger.log(`WS connected userId=${payload.sub}`);
        } catch {
            this.logger.warn(`WS connection rejected: invalid token`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket): void {
        this.logger.log(`WS disconnected clientId=${client.id}`);
    }

    /** Emit current job state to all sockets belonging to this user. */
    emitProgress(userId: string, job: TaskSyncJobDocument): void {
        this.server.to(`user:${userId}`).emit('sync:progress', toSyncJobDto(job));
    }
}
