import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CtmApiClient } from '@ctm/api-client';
import { registerTaskTools } from './tools/tasks.tool.js';
import { registerConnectorTools } from './tools/connectors.tool.js';
import { registerNotificationTools } from './tools/notifications.tool.js';
import { registerAppsTools } from './tools/apps.tool.js';
import { ToolRegistry } from './protocol/tool-registry.js';
import { StatelessDispatcher, type Implementation } from './protocol/dispatcher.js';
import { appLogger } from '../logging/app-logger.js';

const SERVER_INFO: Implementation = { name: 'ctm-mcp', version: '1.0.0' };

@Injectable()
export class McpService {
    private readonly logger = appLogger('McpService');

    constructor(private readonly config: ConfigService) {}

    /** Build the tool set available to the caller of this request. */
    createToolRegistry(accessToken: string): ToolRegistry {
        const client = new CtmApiClient({
            baseUrl: this.config.getOrThrow<string>('CTM_API_BASE_URL'),
            accessToken,
        });

        const registry = new ToolRegistry(this.logger);

        registerTaskTools({ registry, client });
        registerConnectorTools({ registry, client });
        registerNotificationTools({ registry, client });
        registerAppsTools({ registry, client });

        return registry;
    }

    /** Dispatcher for revision 2026-07-28, which the MCP SDK does not yet implement. */
    createDispatcher(registry: ToolRegistry): StatelessDispatcher {
        return new StatelessDispatcher(registry, SERVER_INFO);
    }

    /** SDK server for the revisions that still negotiate through `initialize`. */
    createServer(registry: ToolRegistry): McpServer {
        const server = new McpServer(SERVER_INFO);

        registry.applyTo(server);

        return server;
    }
}
