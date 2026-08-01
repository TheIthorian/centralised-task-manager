import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type { CancelSyncJobParams, GetSyncJobParams, SyncConnectorParams, TaskSyncJobDto } from './sync.types.js';

/** Background pull-sync jobs for a connection. */
export class SyncClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** Start a pull-sync job for a connection. */
    async syncConnector({ connectionId }: SyncConnectorParams): Promise<TaskSyncJobDto> {
        return this.http.request<TaskSyncJobDto>({
            method: 'POST',
            path: `/connectors/connections/${connectionId}/sync`,
        });
    }

    /** Get the status of a sync job. */
    async getSyncJob({ connectionId, jobId }: GetSyncJobParams): Promise<TaskSyncJobDto> {
        return this.http.request<TaskSyncJobDto>({
            method: 'GET',
            path: `/connectors/connections/${connectionId}/sync/${jobId}`,
        });
    }

    /** Cancel a sync job. */
    async cancelSyncJob({ connectionId, jobId }: CancelSyncJobParams): Promise<void> {
        await this.http.request<void>({
            method: 'DELETE',
            path: `/connectors/connections/${connectionId}/sync/${jobId}`,
        });
    }
}
