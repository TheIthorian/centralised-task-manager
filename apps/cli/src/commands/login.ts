import type { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { CtmApiClient } from '@ctm/api-client';
import { writeConfig } from '../auth.js';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** Register `ctm login` on the given commander program. */
export function registerLoginCommand(program: Command): void {
    program
        .command('login')
        .description('Log in and store credentials')
        .option('--base-url <url>', 'API base URL', process.env['CTM_BASE_URL'] ?? DEFAULT_BASE_URL)
        .action(async (opts: { baseUrl: string }) => {
            const email = await input({ message: 'Email:' });
            const pwd = await password({ message: 'Password:', mask: '*' });

            const client = new CtmApiClient({ baseUrl: opts.baseUrl });

            try {
                const tokens = await client.login({ email, password: pwd });
                writeConfig({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, baseUrl: opts.baseUrl });
                console.log(`Logged in as ${tokens.user.email}`);
            } catch (err: unknown) {
                console.error('Login failed:', err instanceof Error ? err.message : String(err));
                process.exit(1);
            }
        });
}
