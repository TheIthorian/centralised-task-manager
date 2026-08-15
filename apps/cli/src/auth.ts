import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TokenGrant } from '@ctm/api-client';
import { InternalError } from '@ctm/errors';
import { normalizeBaseUrl } from './base-url.js';

/** The credentials half of the config: how to prove who you are, and where they can be spent. */
export type StoredTokens = {
    accessToken: string;
    refreshToken: string;
    grant: TokenGrant;
};

/** Which server the CLI talks to, and as which client. */
export type CliConfig = {
    baseUrl: string;
    clientId?: string;
};

/** Everything `ctm login` persists to ~/.config/ctm/config.json. */
export type CliSession = CliConfig & StoredTokens;

const CONFIG_PATH = path.join(os.homedir(), '.config', 'ctm', 'config.json');

// Tokens live in this file in the clear, so it is owner-only. Anything running as this user can
// still read them; the CLI does not try to defend against that.
const CONFIG_MODE = 0o600;

/** Read the stored base URL and client id, or null when the CLI has never been logged in. */
export function readConfig(): CliConfig | null {
    const raw = readConfigFile();

    if (raw === null) return null;

    const baseUrl = raw['baseUrl'];

    if (typeof baseUrl !== 'string') return null;

    const clientId = raw['clientId'];

    return { baseUrl, ...(typeof clientId === 'string' ? { clientId } : {}) };
}

/** Read the full session. Returns null when there is no config, or no credentials in it. */
export function readSession(): CliSession | null {
    const config = readConfig();
    const raw = readConfigFile();

    if (!config || raw === null) return null;

    const accessToken = raw['accessToken'];
    const refreshToken = raw['refreshToken'];
    const grant = raw['grant'];

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null;

    return {
        ...config,
        accessToken,
        refreshToken,
        // A file written before the grant was recorded came from the browser flow, the only login
        // that stored a client id.
        grant: isGrant(grant) ? grant : inferGrant(config),
    };
}

/** Persist config and credentials together. */
export function writeSession(session: CliSession): void {
    writeConfigFile({ ...session, baseUrl: normalizeBaseUrl(session.baseUrl) });
}

/** Replace the stored tokens, leaving the rest of the config alone. */
export function updateStoredTokens({ baseUrl, tokens }: { baseUrl: string; tokens: StoredTokens }): void {
    const config = readConfig() ?? { baseUrl: normalizeBaseUrl(baseUrl) };

    writeConfigFile({ ...config, ...tokens });
}

/** Write config without credentials, dropping any that were stored with it. */
export function writeConfig(config: CliConfig): void {
    writeConfigFile(config);
}

/** Delete the stored config and credentials. */
export function clearConfig(): void {
    if (fs.existsSync(CONFIG_PATH)) fs.rmSync(CONFIG_PATH);
}

function writeConfigFile(contents: CliConfig | CliSession): void {
    try {
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(contents, null, 2), { encoding: 'utf-8', mode: CONFIG_MODE });

        // The mode argument only applies when writeFileSync creates the file, so a config written
        // by an older version would otherwise keep whatever permissions it already had.
        fs.chmodSync(CONFIG_PATH, CONFIG_MODE);
    } catch (err: unknown) {
        throw new InternalError(
            `Failed to write CLI config to ${CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
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

function inferGrant(config: CliConfig): TokenGrant {
    return config.clientId === undefined ? TokenGrant.Session : TokenGrant.OAuth;
}

function isGrant(value: unknown): value is TokenGrant {
    return Object.values(TokenGrant).includes(value as TokenGrant);
}
