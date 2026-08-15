import type { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { CtmApiClient } from '@ctm/api-client';
import { writeSession } from '../auth.js';
import { TokenGrant } from '../token-store.js';
import { bakedBaseUrl } from '../baked-config.js';
import { print } from '../output.js';
import { CLI_CLIENT_ID, performOAuthLogin } from '../oauth.js';

/** Register `ctm login` on the given commander program. */
export function registerLoginCommand(program: Command): void {
    program
        .command('login')
        .description('Log in and store credentials')
        .option('--base-url <url>', 'API base URL', process.env['CTM_BASE_URL'] ?? bakedBaseUrl() ?? undefined)
        .option('--password', 'Use password login instead of browser OAuth')
        .action(async (opts: { baseUrl?: string; password?: boolean }) => {
            if (!opts.baseUrl) {
                console.error('Base URL is required. Pass --base-url <url> or set CTM_BASE_URL.');
                process.exit(1);
            }

            if (opts.password) {
                await passwordLogin(opts.baseUrl);
            } else {
                await oauthLogin(opts.baseUrl);
            }
        });
}

async function oauthLogin(baseUrl: string): Promise<void> {
    try {
        const { accessToken, refreshToken } = await performOAuthLogin({ baseUrl, clientId: CLI_CLIENT_ID });

        writeSession({ accessToken, refreshToken, grant: TokenGrant.OAuth, baseUrl, clientId: CLI_CLIENT_ID });

        const client = new CtmApiClient({ baseUrl, accessToken });
        const me = await client.getMe();

        print(`Logged in as ${me.email}`);
    } catch (err: unknown) {
        console.error('Login failed:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

async function passwordLogin(baseUrl: string): Promise<void> {
    const email = await input({ message: 'Email:' });
    const pwd = await password({ message: 'Password:', mask: '*' });

    const client = new CtmApiClient({ baseUrl });

    try {
        const tokens = await client.login({ email, password: pwd });

        if (!tokens.refreshToken) {
            console.error('Login failed: server did not return a refresh token');
            process.exit(1);
        }

        writeSession({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            grant: TokenGrant.Session,
            baseUrl,
        });

        print(`Logged in as ${tokens.user.email}`);
    } catch (err: unknown) {
        console.error('Login failed:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
