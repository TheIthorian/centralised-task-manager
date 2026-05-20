import { getClient } from './client.js';
import type { ConnectorStatusDto } from './types.js';

/** List all connectors and their connection status. */
export async function listConnectors(): Promise<ConnectorStatusDto[]> {
    const { data } = await getClient().get<ConnectorStatusDto[]>('/connectors');

    return data;
}

/** Get the OAuth authorisation URL for a connector source. */
export async function getConnectorAuthUrl(source: string): Promise<string> {
    const { data } = await getClient().get<{ url: string }>(`/connectors/${source}/auth`);

    return data.url;
}

/** Disconnect (delete) a connector. */
export async function disconnectConnector(source: string): Promise<void> {
    await getClient().delete(`/connectors/${source}`);
}
