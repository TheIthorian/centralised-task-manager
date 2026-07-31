export enum ConnectorType {
    TaskSync = 'task_sync',
    Notification = 'notification',
}

/** Stored connector config for a connected source. */
export type ConnectorConfigDto = {
    id: string;
    source: string;
    enabled: boolean;
    lastSyncedAt?: string;
    lastError?: string;
};

/** OAuth redirect URL for initiating a connector auth flow. */
export type ConnectorAuthUrlDto = {
    url: string;
};

/** A Notion database available to the connected integration. */
export type NotionDatabaseDto = {
    id: string;
    name: string;
};

/** Connector-specific connection details payload (e.g. Notion database ID). */
export type ConnectorDetailsDto = Record<string, unknown>;

/** Response after updating a connector config. */
export type UpdateConnectorResponseDto = {
    id: string;
    enabled: boolean;
};

/** One connected external account under a source. */
export type ConnectorAccountDto = {
    connectionId: string;
    externalAccountId: string;
    email: string | null;
    label: string | null;
    lastSynced?: string;
    setupRequired: boolean;
};

/** Connection status for a single task source connector (now multi-account). */
export type ConnectorStatusDto = {
    source: string;
    connectorType: ConnectorType;
    connectionSchema: Record<string, unknown>;
    accounts: ConnectorAccountDto[];
};

/** Health-check result for a single connected task-sync connection. */
export type ConnectorHealthDto = {
    source: string;
    connectionId: string;
    healthy: boolean;
    error?: string;
};

/** Discord connection status for the current user. */
export type DiscordStatusDto = {
    connected: boolean;
    discordUserId?: string;
};

/** Parameters for {@link ConnectorsClient.getConnectorAuthUrl}. */
export type GetConnectorAuthUrlParams = {
    source: string;
};

/** Parameters for {@link ConnectorsClient.disconnectConnector}. */
export type DisconnectConnectorParams = {
    connectionId: string;
};

/** Parameters for {@link ConnectorsClient.setConnectionDetails}. */
export type SetConnectionDetailsParams = {
    connectionId: string;
    details: ConnectorDetailsDto;
};

/** Parameters for {@link ConnectorsClient.listNotionDatabases}. */
export type ListNotionDatabasesParams = {
    connectionId: string;
};
