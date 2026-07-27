import { ApiProperty } from '@nestjs/swagger';
import {
    ConnectorType,
    type ConnectorAccountDto as IConnectorAccountDto,
    type ConnectorAuthUrlDto as IConnectorAuthUrlDto,
    type ConnectorHealthDto as IConnectorHealthDto,
    type ConnectorStatusDto as IConnectorStatusDto,
    type NotionDatabaseDto as INotionDatabaseDto,
    type UpdateConnectorResponseDto as IUpdateConnectorResponseDto,
} from '@ctm/api-client';

/** One connected external account under a source. */
export class ConnectorAccountDto implements IConnectorAccountDto {
    connectionId!: string;
    externalAccountId!: string;
    email!: string | null;
    label!: string | null;
    lastSynced?: string;
    setupRequired!: boolean;
}

/** Connection status for a single task source connector. */
export class ConnectorStatusDto implements IConnectorStatusDto {
    source!: string;

    @ApiProperty({ enum: ConnectorType, enumName: 'ConnectorType' })
    connectorType!: ConnectorType;

    /** JSON Schema describing the connection fields this connector needs. */
    @ApiProperty({ type: 'object', additionalProperties: true })
    connectionSchema!: Record<string, unknown>;

    accounts!: ConnectorAccountDto[];
}

/** Health-check result for a single connected task-sync connection. */
export class ConnectorHealthDto implements IConnectorHealthDto {
    source!: string;
    connectionId!: string;
    healthy!: boolean;
    error?: string;
}

/** OAuth redirect URL for initiating a connector auth flow. */
export class ConnectorAuthUrlDto implements IConnectorAuthUrlDto {
    url!: string;
}

/** A Notion database available to the connected integration. */
export class NotionDatabaseDto implements INotionDatabaseDto {
    id!: string;
    name!: string;
}

/** Response after updating a connector config. */
export class UpdateConnectorResponseDto implements IUpdateConnectorResponseDto {
    id!: string;
    enabled!: boolean;
}
