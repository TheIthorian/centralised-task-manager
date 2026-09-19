import { Types } from 'mongoose';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExternalTaskSourceRegistry } from '@ctm/connectors';
import type { ConnectorConfigDocument } from '@ctm/db';
import { ConnectorsService } from '../connectors/connectors.service.js';
import { SyncService } from './sync.service.js';
import { ScheduledSyncService } from './scheduled-sync.service.js';

describe('ScheduledSyncService', () => {
    const userId = new Types.ObjectId();
    const connectionA = new Types.ObjectId();
    const connectionB = new Types.ObjectId();

    const connections = [
        { _id: connectionA, userId },
        { _id: connectionB, userId },
    ] as unknown as ConnectorConfigDocument[];

    const connectors = {
        listEnabledConnections: vi.fn().mockResolvedValue(connections),
    } as unknown as ConnectorsService;

    const registry = {
        list: vi.fn().mockReturnValue(['google_tasks', 'todoist']),
    } as unknown as ExternalTaskSourceRegistry;

    const sync = {
        runJobToCompletion: vi.fn().mockResolvedValue(undefined),
    } as unknown as SyncService;

    let service: ScheduledSyncService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ScheduledSyncService(connectors, registry, sync);
    });

    it('syncs every enabled connection', async () => {
        await service.runNightlySync();

        expect(connectors.listEnabledConnections).toHaveBeenCalledWith({
            sources: ['google_tasks', 'todoist'],
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
