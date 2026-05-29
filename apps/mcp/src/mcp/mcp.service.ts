import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CtmApiClient } from '@ctm/api-client';
import { registerTaskTools } from './tools/tasks.tool.js';
import { registerConnectorTools } from './tools/connectors.tool.js';
import { registerNotificationTools } from './tools/notifications.tool.js';
import { registerAppsTools } from './tools/apps.tool.js';

@Injectable()
export class McpService {
    constructor(private readonly config: ConfigService) {}

    /** Create a fully-configured McpServer bound to the caller's access token. */
    createServer(accessToken: string): McpServer {
        const client = new CtmApiClient({
            baseUrl: this.config.getOrThrow<string>('CTM_API_BASE_URL'),
            accessToken,
        });

        const server = new McpServer({ name: 'ctm-mcp', version: '1.0.0' });

        registerTaskTools(server, client);
        registerConnectorTools(server, client);
        registerNotificationTools(server, client);
        registerAppsTools(server, client);

        return server;
    }
}
