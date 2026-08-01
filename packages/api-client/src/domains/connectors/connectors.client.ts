import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type {
    ConnectorHealthDto,
    ConnectorStatusDto,
    DisconnectConnectorParams,
    DiscordStatusDto,
    GetConnectorAuthUrlParams,
    ListNotionDatabasesParams,
    SetConnectionDetailsParams,
} from './connectors.types.js';

/** Connected sources and their per-connection settings, including the Discord routes under /connectors. */
export class ConnectorsClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** List all connector statuses for the current user. */
    async listConnectors(): Promise<ConnectorStatusDto[]> {
        return this.http.request<ConnectorStatusDto[]>({ method: 'GET', path: '/connectors' });
    }

    /** Health-check all connected task-sync connectors for the current user. */
    async getConnectorHealth(): Promise<ConnectorHealthDto[]> {
        return this.http.request<ConnectorHealthDto[]>({ method: 'GET', path: '/connectors/health' });
    }

    /** Get the OAuth authorisation URL for a connector source. */
    async getConnectorAuthUrl({ source }: GetConnectorAuthUrlParams): Promise<string> {
        const response = await this.http.request<{ url: string }>({
            method: 'GET',
            path: `/connectors/${source}/auth`,
        });

        return response.url;
    }

    /** Disconnect a single connection by id. */
    async disconnectConnector({ connectionId }: DisconnectConnectorParams): Promise<void> {
        await this.http.request<void>({ method: 'DELETE', path: `/connectors/connections/${connectionId}` });
    }

    /** Save connection details for a connection (e.g. Notion database ID). */
    async setConnectionDetails({ connectionId, details }: SetConnectionDetailsParams): Promise<void> {
        await this.http.request<void>({
            method: 'POST',
            path: `/connectors/connections/${connectionId}/connection-details`,
            body: details,
        });
    }

    /** List Notion databases accessible via a connection's Notion integration. */
    async listNotionDatabases({
        connectionId,
    }: ListNotionDatabasesParams): Promise<{ id: string; name: string }[]> {
        return this.http.request<{ id: string; name: string }[]>({
            method: 'GET',
            path: `/connectors/connections/${connectionId}/notion/databases`,
        });
    }

    /** Get the Discord OAuth URL for connecting. */
    async getDiscordConnectUrl(): Promise<string> {
        const response = await this.http.request<{ url: string }>({
            method: 'GET',
            path: '/connectors/discord/connect-url',
        });
        return response.url;
    }

    /** Get Discord connection status. */
    async getDiscordStatus(): Promise<DiscordStatusDto> {
        return this.http.request<DiscordStatusDto>({ method: 'GET', path: '/connectors/discord/status' });
    }

    /** Disconnect Discord. */
    async disconnectDiscord(): Promise<void> {
        await this.http.request<void>({ method: 'DELETE', path: '/connectors/discord' });
    }
}
