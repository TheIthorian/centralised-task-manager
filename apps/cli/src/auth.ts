import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InternalError } from '@ctm/errors';
import { clearTokens, readTokens, writeTokens, type StoredTokens } from './token-store.js';

/** Non-secret CLI state, persisted to ~/.config/ctm/config.json. */
export type CliConfig = {
    baseUrl: string;
    clientId?: string;
};

/** Everything a command needs to talk to the API: config plus the tokens from the secret store. */
export type CliSession = CliConfig & StoredTokens;

const CONFIG_PATH = path.join(os.homedir(), '.config', 'ctm', 'config.json');

/** Read stored config, or null if not present. */
export function readConfig(): CliConfig | null {
    const raw = readConfigFile();

    if (raw === null) return null;

    const baseUrl = raw['baseUrl'];

    if (typeof baseUrl !== 'string') return null;

    const clientId = raw['clientId'];

    return { baseUrl, ...(typeof clientId === 'string' ? { clientId } : {}) };
}

/** Read the full session: config plus tokens. Returns null when the user is not logged in. */
export function readSession(): CliSession | null {
    const config = readConfig();

    if (!config) return null;

    const stored = readTokens({ baseUrl: config.baseUrl });

    return stored ? { ...config, ...stored } : null;
}

/** Persist config and tokens, putting the tokens in the OS secret store. */
export function writeSession(session: CliSession): void {
    const { accessToken, refreshToken, grant, ...config } = session;

    writeTokens({ baseUrl: config.baseUrl, tokens: { accessToken, refreshToken, grant } });
    writeConfig(config);
}

/** Replace the stored tokens for the current base URL, leaving the rest of the config alone. */
export function updateStoredTokens({ baseUrl, tokens }: { baseUrl: string; tokens: StoredTokens }): void {
    writeTokens({ baseUrl, tokens });
}

/** Write non-secret config to disk, creating parent dirs as needed. */
export function writeConfig(config: CliConfig): void {
    try {
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err: unknown) {
        throw new InternalError(
            `Failed to write CLI config to ${CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

/** Delete the config file and the stored tokens. */
export function clearConfig(): void {
    const config = readConfig();

    if (config) clearTokens({ baseUrl: config.baseUrl });

    if (fs.existsSync(CONFIG_PATH)) fs.rmSync(CONFIG_PATH);
}

function readConfigFile(): Record<string, unknown> | null {
    if (!fs.existsSync(CONFIG_PATH)) return null;

    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}
