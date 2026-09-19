import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConnectorName, ExternalTaskSourceRegistry } from '@ctm/connectors';
import { appLogger } from '../logging/app-logger.js';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { SyncService } from './sync.service.js';

@Injectable()
export class ScheduledSyncService {
    private readonly logger = appLogger(ScheduledSyncService.name);

    constructor(
        private readonly connectors: ConnectorsService,
        private readonly registry: ExternalTaskSourceRegistry,
        private readonly sync: SyncService,
    ) {}

    /**
     * Run at midnight. Sync every enabled task connection, which also rotates its OAuth
     * tokens — Google drops a refresh token that goes six months unused.
     */
    @Cron('0 0 * * *')
    async runNightlySync(): Promise<void> {
        const sources = this.registry.list() as unknown as ConnectorName[];
        const connections = await this.connectors.listEnabledConnections({ sources });

        this.logger.info({ connectionCount: connections.length }, 'Starting nightly sync');

        let failed = 0;

        // Sequential: a burst of parallel syncs would hit every provider's rate limit at once.
        for (const connection of connections) {
            const userId = String(connection.userId);
            const connectionId = String(connection._id);

            try {
                await this.sync.runJobToCompletion({ userId, connectionId });
            } catch (err) {
                failed++;

                this.logger.error({ err, userId, connectionId }, 'Nightly sync failed for connection');
            }
        }

        this.logger.info({ connectionCount: connections.length, failed }, 'Finished nightly sync');
    }
}
