import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all connector-related MCP tools on the given server instance. */
export function registerConnectorTools(server: McpServer, client: CtmApiClient): void {
    server.registerTool(
        'list_connectors',
        {
            description:
                'List all task sources with their connected accounts (each account has a connectionId used by the other connector tools).',
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
            description: 'Disconnect a single connection by its connectionId (from list_connectors).',
            inputSchema: { connectionId: z.string().min(1) },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ connectionId }) => {
            await client.disconnectConnector({ connectionId });
            return { content: [{ type: 'text' as const, text: `Connection ${connectionId} disconnected.` }] };
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
            description: 'Trigger a pull-sync job for a connection (connectionId from list_connectors).',
            inputSchema: { connectionId: z.string().min(1) },
            annotations: { destructiveHint: false, idempotentHint: false },
        },
        async ({ connectionId }) => {
            const job = await client.syncConnector({ connectionId });
            return { content: [{ type: 'text' as const, text: JSON.stringify(job) }] };
        },
    );

    server.registerTool(
        'get_sync_job',
        {
            description: 'Get the current status of a sync job.',
            inputSchema: {
                connectionId: z.string().min(1),
                jobId: z.string().min(1),
            },
            annotations: { readOnlyHint: true },
        },
        async ({ connectionId, jobId }) => {
            const job = await client.getSyncJob({ connectionId, jobId });
            return { content: [{ type: 'text' as const, text: JSON.stringify(job) }] };
        },
    );

    server.registerTool(
        'cancel_sync_job',
        {
            description: 'Cancel an in-progress sync job.',
            inputSchema: {
                connectionId: z.string().min(1),
                jobId: z.string().min(1),
            },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ connectionId, jobId }) => {
            await client.cancelSyncJob({ connectionId, jobId });
            return { content: [{ type: 'text' as const, text: `Sync job ${jobId} cancelled.` }] };
        },
    );

    server.registerTool(
        'set_connection_details',
        {
            description:
                'Save connection-specific details (e.g. Notion database ID) for a connection. Pass a JSON object of key-value pairs.',
            inputSchema: {
                connectionId: z.string().min(1),
                details: z
                    .record(z.string(), z.unknown())
                    .describe('Connector-specific details as a key-value object (e.g. {"databaseId": "abc123"})'),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        async ({ connectionId, details }) => {
            await client.setConnectionDetails({ connectionId, details });
            return { content: [{ type: 'text' as const, text: `Connection details for ${connectionId} updated.` }] };
        },
    );

    server.registerTool(
        'list_notion_databases',
        {
            description: 'List Notion databases accessible via a Notion connection (connectionId from list_connectors).',
            inputSchema: { connectionId: z.string().min(1) },
            annotations: { readOnlyHint: true },
        },
        async ({ connectionId }) => {
            const dbs = await client.listNotionDatabases({ connectionId });
            return { content: [{ type: 'text' as const, text: JSON.stringify(dbs) }] };
        },
    );
}
