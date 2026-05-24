import { ConnectorName } from '@ctm/connectors';

export type BaseConnectorConfig = {
    source: ConnectorName.GoogleTasks | ConnectorName.Todoist | ConnectorName.Notion;
    settings: Record<string, undefined>;
};

export type DiscordSettings = { discordUserId: string; botToken: string; dmChannelId: string | null };
export type DiscordConnectorConfig = { source: ConnectorName.Discord; settings: DiscordSettings };

export type NotionSettings = { databaseId: string };
export type NotionConnectorConfig = { source: ConnectorName.Notion; settings: NotionSettings };

export type ConnectorSettings = BaseConnectorConfig | DiscordConnectorConfig | NotionConnectorConfig;
