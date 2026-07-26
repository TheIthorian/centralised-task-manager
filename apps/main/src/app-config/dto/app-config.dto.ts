import type { AppConfigDto as IAppConfigDto } from '@ctm/api-client';

/** Response from GET /config — public client configuration. */
export class AppConfigDto implements IAppConfigDto {
    /** Base URL of the MCP server clients such as Claude should connect to. */
    mcpUrl!: string;
}
