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

    server.registerTool(
        'get_connector_health',
        {
            description: 'Health-check all connected task-sync sources for the current user.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const health = await client.getConnectorHealth();
            return { content: [{ type: 'text' as const, text: JSON.stringify(health) }] };
        },
    );

    server.registerTool(
        'sync_connector',
        {
            description: 'Trigger a pull-sync job for a connected task source.',
            inputSchema: { source: z.string().min(1) },
            annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ source }) => {
            const job = await client.syncConnector({ source });
            return { content: [{ type: 'text' as const, text: JSON.stringify(job) }] };
        },
    );

    server.registerTool(
        'get_sync_job',
        {
            description: 'Get the current status of a sync job.',
            inputSchema: {
                source: z.string().min(1),
                jobId: z.string().min(1),
            },
            annotations: { readOnlyHint: true },
        },
        async ({ source, jobId }) => {
            const job = await client.getSyncJob({ source, jobId });
            return { content: [{ type: 'text' as const, text: JSON.stringify(job) }] };
        },
    );

    server.registerTool(
        'cancel_sync_job',
        {
            description: 'Cancel an in-progress sync job.',
            inputSchema: {
                source: z.string().min(1),
                jobId: z.string().min(1),
            },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ source, jobId }) => {
            await client.cancelSyncJob({ source, jobId });
            return { content: [{ type: 'text' as const, text: `Sync job ${jobId} cancelled.` }] };
        },
    );

    server.registerTool(
        'set_connection_details',
        {
            description: 'Save connector-specific connection details (e.g. Notion database ID). Pass a JSON object of key-value pairs.',
            inputSchema: {
                source: z.string().min(1),
                details: z.record(z.string(), z.unknown()).describe('Connector-specific details as a key-value object (e.g. {"databaseId": "abc123"})'),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ source, details }) => {
            await client.setConnectionDetails({ source, details });
            return { content: [{ type: 'text' as const, text: `Connection details for ${source} updated.` }] };
        },
    );

    server.registerTool(
        'list_notion_databases',
        {
            description: 'List Notion databases accessible via the connected Notion integration.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const dbs = await client.listNotionDatabases();
            return { content: [{ type: 'text' as const, text: JSON.stringify(dbs) }] };
        },
    );
}
