import type { ToolRegistry } from '../protocol/tool-registry.js';
import { z } from 'zod';
import type { CtmApiClient } from '@ctm/api-client';

/** Register all authorized-app MCP tools on the given registry. */
export function registerAppsTools({ registry, client }: { registry: ToolRegistry; client: CtmApiClient }): void {
    registry.registerTool(
        'list_authorized_apps',
        {
            description: 'List OAuth applications that the current user has authorized.',
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async () => {
            const apps = await client.getAuthorizedApps();
            return { content: [{ type: 'text' as const, text: JSON.stringify(apps) }] };
        },
    );

    registry.registerTool(
        'revoke_authorized_app',
        {
            description: 'Revoke access for an authorized OAuth application by client ID.',
            inputSchema: { clientId: z.string().min(1) },
            annotations: { destructiveHint: true, idempotentHint: true },
        },
        async ({ clientId }) => {
            await client.revokeAuthorizedApp({ clientId });
            return { content: [{ type: 'text' as const, text: `App ${clientId} revoked.` }] };
        },
    );
}
