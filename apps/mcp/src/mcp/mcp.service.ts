import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CtmApiClient } from '@ctm/api-client';
import { registerTaskTools } from './tools/tasks.tool.js';
import { registerConnectorTools } from './tools/connectors.tool.js';
import { registerNotificationTools } from './tools/notifications.tool.js';
import { registerAppsTools } from './tools/apps.tool.js';
import { appLogger } from '../logging/app-logger.js';
import type { Logger } from '@ctm/logger';

@Injectable()
export class McpService {
    private readonly logger = appLogger('McpService');

    constructor(private readonly config: ConfigService) {}

    /** Create a fully-configured McpServer bound to the caller's access token. */
    createServer(accessToken: string): McpServer {
        const client = new CtmApiClient({
            baseUrl: this.config.getOrThrow<string>('CTM_API_BASE_URL'),
            accessToken,
        });

        const server = new McpServer({ name: 'ctm-mcp', version: '1.0.0' });

        logToolFailures({ server, logger: this.logger });

        registerTaskTools(server, client);
        registerConnectorTools(server, client);
        registerNotificationTools(server, client);
        registerAppsTools(server, client);

        return server;
    }
}

/**
 * Log every tool failure before the SDK turns it into an error result. The client only ever sees
 * `error.message`, so without this a failed call leaves no trace of its cause on the server.
 */
function logToolFailures({ server, logger }: { server: McpServer; logger: Logger }): void {
    const register = server.registerTool.bind(server);

    server.registerTool = ((name: string, config: unknown, handler: (...args: unknown[]) => unknown) =>
        register(
            name as never,
            config as never,
            (async (...args: unknown[]): Promise<unknown> => {
                try {
                    return await handler(...args);
                } catch (error) {
                    logger.error({ err: error, tool: name }, `MCP tool ${name} failed`);

                    throw error;
                }
            }) as never,
        )) as unknown as typeof server.registerTool;
}
