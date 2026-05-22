// apps/main/src/sync/sync.gateway.ts
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

@WebSocketGateway({ cors: { origin: '*', credentials: false } })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    private readonly server!: Server;

    private readonly logger = new Logger(SyncGateway.name);

    constructor(private readonly jwt: JwtService) {}

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
        this.server.to(`user:${userId}`).emit('sync:progress', {
            id: String(job._id),
            type: job.type,
            status: job.status,
            source: job.source,
            stage: job.stage,
            synced: job.synced,
            skipped: job.skipped,
            error: job.error,
            completedAt: job.completedAt?.toISOString() ?? null,
        });
    }
}
