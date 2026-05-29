import type { Command } from 'commander';
import { buildClient } from '../client.js';
import { formatJson, formatTable, print } from '../output.js';
import type { ConnectorStatusDto, ConnectorHealthDto, TaskSyncJobDto } from '@ctm/api-client';

function connectorRow(c: ConnectorStatusDto): string[] {
    return [c.source, c.connected ? 'connected' : 'disconnected', c.lastSynced ?? '-'];
}

function healthRow(h: ConnectorHealthDto): string[] {
    return [h.source, h.healthy ? 'healthy' : 'unhealthy', h.error ?? '-'];
}

function syncJobRow(j: TaskSyncJobDto): string[] {
    return [j.id, j.source, j.status, j.stage ?? '-', String(j.synced), String(j.skipped), j.error ?? '-'];
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
                    print(formatJson(result));
                } else {
                    print(formatTable(['Source', 'Status', 'Last Synced'], result.map(connectorRow)));
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
                print(`Opening: ${url}`);
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
                print(`Connector ${source} disconnected.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('health')
        .description('Health-check all connected task-sync sources')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.getConnectorHealth();

                if (opts.json) {
                    print(formatJson(result));
                } else {
                    print(formatTable(['Source', 'Healthy', 'Error'], result.map(healthRow)));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('sync')
        .description('Trigger a pull-sync job for a connected source')
        .argument('<source>', 'Connector source name (e.g. todoist)')
        .option('--json', 'Output as JSON')
        .action(async (source: string, opts: { json?: boolean }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const job = await client.syncConnector({ source });

                if (opts.json) {
                    print(formatJson(job));
                } else {
                    print(formatTable(['ID', 'Source', 'Status', 'Stage', 'Synced', 'Skipped', 'Error'], [syncJobRow(job)]));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('sync-status')
        .description('Check the status of a sync job')
        .argument('<source>', 'Connector source name')
        .argument('<jobId>', 'Sync job ID')
        .option('--json', 'Output as JSON')
        .action(async (source: string, jobId: string, opts: { json?: boolean }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const job = await client.getSyncJob({ source, jobId });

                if (opts.json) {
                    print(formatJson(job));
                } else {
                    print(formatTable(['ID', 'Source', 'Status', 'Stage', 'Synced', 'Skipped', 'Error'], [syncJobRow(job)]));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('sync-cancel')
        .description('Cancel an in-progress sync job')
        .argument('<source>', 'Connector source name')
        .argument('<jobId>', 'Sync job ID')
        .action(async (source: string, jobId: string) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.cancelSyncJob({ source, jobId });

                print(`Sync job ${jobId} cancelled.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('set-details')
        .description('Save connector-specific connection details (e.g. Notion database ID)')
        .argument('<source>', 'Connector source name (e.g. notion)')
        .requiredOption('--details <json>', 'JSON object of connection details (e.g. \'{"databaseId":"abc123"}\')')
        .action(async (source: string, opts: { details: string }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();

            let details: Record<string, unknown>;

            try {
                const parsed: unknown = JSON.parse(opts.details);

                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                    console.error('--details must be a JSON object, not an array or primitive');
                    process.exit(1);
                }

                details = parsed as Record<string, unknown>;
            } catch {
                console.error('--details must be valid JSON');
                process.exit(1);
            }

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.setConnectionDetails({ source, details });

                print(`Connection details for ${source} updated.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    connectors
        .command('notion-databases')
        .description('List Notion databases accessible via the connected Notion integration')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            const parent = connectors.opts<{ token?: string; baseUrl?: string }>();
            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const dbs = await client.listNotionDatabases();

                if (opts.json) {
                    print(formatJson(dbs));
                } else {
                    print(formatTable(['ID', 'Name'], dbs.map((db) => [db.id, db.name])));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });
}
