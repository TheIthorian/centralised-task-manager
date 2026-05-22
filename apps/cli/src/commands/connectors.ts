import type { Command } from 'commander';
import { buildClient } from '../client.js';
import { formatJson, formatTable } from '../output.js';
import type { ConnectorStatusDto } from '@ctm/api-client';

function connectorRow(c: ConnectorStatusDto): string[] {
    return [c.source, c.connected ? 'connected' : 'disconnected', c.lastSynced ?? '-'];
}

/** Register all `ctm connectors *` subcommands on the given program. */
export function registerConnectorsCommand(program: Command): void {
    const connectors = program
        .command('connectors')
        .description('Manage task source connectors')
        .option('--token <token>', 'API token (overrides stored credentials)')
        .option('--base-url <url>', 'API base URL');

    connectors
        .command('list')
        .description('List connector statuses')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.listConnectors();

                if (opts.json) {
                    console.log(formatJson(result));
                } else {
                    console.log(formatTable(['Source', 'Status', 'Last Synced'], result.map(connectorRow)));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('connect')
        .description('Connect a task source (opens OAuth URL in browser)')
        .argument('<source>', 'Connector source name (e.g. todoist, google)')
        .action(async (source: string) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const url = await client.getConnectorAuthUrl({ source });
                console.log(`Opening: ${url}`);
                const { default: open } = await import('open');
                await open(url);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('disconnect')
        .description('Disconnect a task source')
        .argument('<source>', 'Connector source name')
        .action(async (source: string) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.disconnectConnector({ source });
                console.log(`Connector ${source} disconnected.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });
}
