import { Types } from 'mongoose';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectorName, ExternalTaskSourceRegistry, TaskConnectorName } from '@ctm/connectors';
import type { ConnectorConfigDocument } from '@ctm/db';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { SyncService } from './sync.service.js';
import { ScheduledSyncService } from './scheduled-sync.service.js';

describe('ScheduledSyncService', () => {
    const userId = new Types.ObjectId();
    const connectionA = new Types.ObjectId();
    const connectionB = new Types.ObjectId();

    const connectors = new ConnectorsService({} as never, {} as never, {} as never, {} as never);
    const registry = new ExternalTaskSourceRegistry();
    const sync = Object.create(SyncService.prototype) as SyncService;

    let service: ScheduledSyncService;

    beforeEach(() => {
        vi.restoreAllMocks();

        vi.spyOn(registry, 'list').mockReturnValue([TaskConnectorName.GoogleTasks, TaskConnectorName.Todoist]);
        vi.spyOn(connectors, 'streamEnabledConnections').mockImplementation(async function* () {
            yield { _id: connectionA, userId } as ConnectorConfigDocument;
            yield { _id: connectionB, userId } as ConnectorConfigDocument;
        });
        vi.spyOn(sync, 'runJobToCompletion').mockResolvedValue(undefined);

        service = new ScheduledSyncService(connectors, registry, sync);
    });

    it('syncs every enabled connection', async () => {
        await service.runNightlySync();

        expect(connectors.streamEnabledConnections).toHaveBeenCalledWith({
            sources: [ConnectorName.GoogleTasks, ConnectorName.Todoist],
        });
        expect(sync.runJobToCompletion).toHaveBeenCalledTimes(2);
        expect(sync.runJobToCompletion).toHaveBeenCalledWith({
            userId: String(userId),
            connectionId: String(connectionA),
        });
    });

    it('continues after a connection fails', async () => {
        vi.mocked(sync.runJobToCompletion).mockRejectedValueOnce(new Error('boom'));

        await expect(service.runNightlySync()).resolves.toBeUndefined();

        expect(sync.runJobToCompletion).toHaveBeenCalledTimes(2);
    });
});
