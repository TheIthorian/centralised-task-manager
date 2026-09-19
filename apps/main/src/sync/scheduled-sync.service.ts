import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExternalTaskSourceRegistry, toConnectorName } from '@ctm/connectors';
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
        const sources = this.registry.list().map(toConnectorName);

        this.logger.info({ sources }, 'Starting nightly sync');

        let synced = 0;
        let failed = 0;

        // Sequential: a burst of parallel syncs would hit every provider's rate limit at once.
        for await (const connection of this.connectors.streamEnabledConnections({ sources })) {
            const userId = String(connection.userId);
            const connectionId = String(connection._id);

            try {
                await this.sync.runJobToCompletion({ userId, connectionId });

                synced++;
            } catch (err) {
                failed++;

                this.logger.error({ err, userId, connectionId }, 'Nightly sync failed for connection');
            }
        }

        this.logger.info({ synced, failed }, 'Finished nightly sync');
    }
}
