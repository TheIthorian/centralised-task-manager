import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all connector-related MCP tools on the given server instance. */
export function registerConnectorTools(server: McpServer, client: CtmApiClient): void {
    server.registerTool(
        'list_connectors',
        {
            description: 'List all connected task sources and their sync status.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const connectors = await client.listConnectors();
            return { content: [{ type: 'text' as const, text: JSON.stringify(connectors) }] };
        },
    );

    server.registerTool(
        'get_connector_auth_url',
        {
            description: 'Get the OAuth authorisation URL to connect a task source (e.g. "todoist", "google").',
            inputSchema: { source: z.string().min(1) },
            annotations: { readOnlyHint: true },
        },
        async ({ source }) => {
            const url = await client.getConnectorAuthUrl({ source });
            return { content: [{ type: 'text' as const, text: url }] };
        },
    );

    server.registerTool(
        'disconnect_connector',
        {
            description: 'Disconnect a task source by name.',
            inputSchema: { source: z.string().min(1) },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ source }) => {
            await client.disconnectConnector({ source });
            return { content: [{ type: 'text' as const, text: `Connector ${source} disconnected.` }] };
        },
    );
}
