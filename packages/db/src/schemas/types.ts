import { ConnectorName } from '@ctm/connectors';

// Re-exported because `ConnectorConfig.source` is constrained to it: anything reading or writing
// that column needs the vocabulary, and should not have to depend on @ctm/connectors for it.
export { ConnectorName };

export type BaseConnectorConfig = {
    source: ConnectorName.GoogleTasks | ConnectorName.Todoist | ConnectorName.Notion;
    settings: Record<string, undefined>;
};

export type DiscordSettings = { discordUserId: string; botToken: string; dmChannelId: string | null };
export type DiscordConnectorConfig = { source: ConnectorName.Discord; settings: DiscordSettings };

export type NotionSettings = { databaseId: string };
export type NotionConnectorConfig = { source: ConnectorName.Notion; settings: NotionSettings };

export type ConnectorSettings = BaseConnectorConfig | DiscordConnectorConfig | NotionConnectorConfig;
