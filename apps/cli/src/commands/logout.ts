import type { Command } from 'commander';
import { clearConfig } from '../auth.js';

/** Register `ctm logout` on the given commander program. */
export function registerLogoutCommand(program: Command): void {
    program
        .command('logout')
        .description('Clear stored credentials')
        .action(() => {
            clearConfig();
            console.log('Logged out.');
        });
}
