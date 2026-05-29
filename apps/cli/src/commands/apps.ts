import type { Command } from 'commander';
import { buildClient } from '../client.js';
import { formatJson, formatTable, print } from '../output.js';
import type { AuthorizedAppDto } from '@ctm/api-client';

function appRow(a: AuthorizedAppDto): string[] {
    return [a.clientId, a.clientName, a.scopes.join(', '), a.authorizedAt];
}

/** Register all `ctm apps *` subcommands on the given program. */
export function registerAppsCommand(program: Command): void {
    const apps = program
        .command('apps')
        .description('Manage authorized OAuth applications')
        .option('--token <token>', 'API token (overrides stored credentials)')
        .option('--base-url <url>', 'API base URL');

    apps
        .command('list')
        .description('List authorized OAuth applications')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            const parent = apps.opts<{ token?: string; baseUrl?: string }>();

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                const result = await client.getAuthorizedApps();

                if (opts.json) {
                    print(formatJson(result));
                } else {
                    print(formatTable(['Client ID', 'Name', 'Scopes', 'Authorized At'], result.map(appRow)));
                }
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });

    apps
        .command('revoke')
        .description('Revoke access for an authorized OAuth application')
        .argument('<clientId>', 'OAuth client ID to revoke')
        .action(async (clientId: string) => {
            const parent = apps.opts<{ token?: string; baseUrl?: string }>();

            try {
                const client = buildClient({ token: parent.token, baseUrl: parent.baseUrl });
                await client.revokeAuthorizedApp({ clientId });

                print(`App ${clientId} revoked.`);
            } catch (err: unknown) {
                console.error(err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });
}
