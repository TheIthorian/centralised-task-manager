import type { Command } from 'commander';
import { clearConfig } from '../auth.js';
import { print } from '../output.js';

/** Register `ctm logout` on the given commander program. */
export function registerLogoutCommand(program: Command): void {
    program
        .command('logout')
        .description('Clear stored credentials')
        .action(() => {
            clearConfig();
            print('Logged out.');
        });
}
