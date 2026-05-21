import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all connector-related MCP tools on the given server instance. */
export function registerConnectorTools(server: McpServer, client: CtmApiClient): void {
    server.tool(
        'list_connectors',
        'List all connected task sources and their sync status.',
        {},
        async () => {
            const connectors = await client.listConnectors();
            return { content: [{ type: 'text' as const, text: JSON.stringify(connectors) }] };
        },
    );

    server.tool(
        'get_connector_auth_url',
        'Get the OAuth authorisation URL to connect a task source (e.g. "todoist", "google").',
        { source: z.string().min(1) },
        async ({ source }) => {
            const url = await client.getConnectorAuthUrl({ source });
            return { content: [{ type: 'text' as const, text: url }] };
        },
    );

    server.tool(
        'disconnect_connector',
        'Disconnect a task source by name.',
        { source: z.string().min(1) },
        async ({ source }) => {
            await client.disconnectConnector({ source });
            return { content: [{ type: 'text' as const, text: `Connector ${source} disconnected.` }] };
        },
    );
}
