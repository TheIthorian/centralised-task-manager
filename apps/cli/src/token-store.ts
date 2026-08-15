import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Entry } from '@napi-rs/keyring';
import { TokenGrant } from '@ctm/api-client';
import { ConfigurationError } from '@ctm/errors';
import { normalizeBaseUrl } from './base-url.js';

/** The secret half of the CLI's credentials. Never written to the config file. */
export type StoredTokens = {
    accessToken: string;
    refreshToken: string;
    grant: TokenGrant;
};

export { TokenGrant };

/** Where credentials are kept. `File` is opt-in and unencrypted. */
export enum TokenStoreBackend {
    Keyring = 'keyring',
    File = 'file',
}

const SERVICE = 'ctm';
const FILE_STORE_PATH = path.join(os.homedir(), '.config', 'ctm', 'credentials.json');

/**
 * Read the tokens stored for a base URL, or null when nothing is stored.
 *
 * @throws ConfigurationError when an entry exists but cannot be read as a token set.
 */
export function readTokens({ baseUrl }: { baseUrl: string }): StoredTokens | null {
    const account = normalizeBaseUrl(baseUrl);
    const raw =
        activeBackend() === TokenStoreBackend.File ? readFileStore({ account }) : entryFor(account).getPassword();

    if (raw === null || raw === undefined) return null;

    const parsed = parseTokens(raw);

    // Something else owns this entry, or a half-formed write left it unusable. Either way the user
    // cannot act on "not logged in" when the store plainly holds an entry for this server.
    if (parsed === null) {
        throw new ConfigurationError(
            `The credentials stored for ${account} are not readable. Run \`ctm login\` to replace them.`,
        );
    }

    return parsed;
}

/** Store tokens for a base URL, replacing anything already held. */
export function writeTokens({ baseUrl, tokens }: { baseUrl: string; tokens: StoredTokens }): void {
    const account = normalizeBaseUrl(baseUrl);
    const secret = JSON.stringify(tokens);

    if (activeBackend() === TokenStoreBackend.File) {
        writeFileStore({ account, secret });

        return;
    }

    entryFor(account).setPassword(secret);
}

/** Remove stored tokens for a base URL. No-op when nothing is stored. */
export function clearTokens({ baseUrl }: { baseUrl: string }): void {
    const account = normalizeBaseUrl(baseUrl);

    if (activeBackend() === TokenStoreBackend.File) {
        removeFromFileStore({ account });

        return;
    }

    entryFor(account).deletePassword();
}

/**
 * The backend in use. `CTM_TOKEN_STORE=file` forces the plain file, for CI and headless boxes with
 * no secret service running; there is no automatic fallback, so a keyring that cannot be reached
 * is an error the user sees rather than a credential quietly written to disk in the clear.
 */
export function activeBackend(): TokenStoreBackend {
    return process.env['CTM_TOKEN_STORE'] === 'file' ? TokenStoreBackend.File : TokenStoreBackend.Keyring;
}

/** One item per server, so logging into a second server does not evict the first. */
function entryFor(account: string): Entry {
    return new Entry(SERVICE, account);
}

function readFileStore({ account }: { account: string }): string | null {
    return readWholeFileStore()[account] ?? null;
}

function writeFileStore({ account, secret }: { account: string; secret: string }): void {
    const existing = readWholeFileStore();

    existing[account] = secret;

    fs.mkdirSync(path.dirname(FILE_STORE_PATH), { recursive: true });
    fs.writeFileSync(FILE_STORE_PATH, JSON.stringify(existing, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function removeFromFileStore({ account }: { account: string }): void {
    if (!fs.existsSync(FILE_STORE_PATH)) return;

    const existing = readWholeFileStore();

    delete existing[account];

    fs.writeFileSync(FILE_STORE_PATH, JSON.stringify(existing, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function readWholeFileStore(): Record<string, string> {
    if (!fs.existsSync(FILE_STORE_PATH)) return {};

    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(FILE_STORE_PATH, 'utf-8'));

        if (typeof parsed !== 'object' || parsed === null) return {};

        const result: Record<string, string> = {};

        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof value === 'string') result[key] = value;
        }

        return result;
    } catch {
        return {};
    }
}

function parseTokens(raw: string): StoredTokens | null {
    try {
        const parsed: unknown = JSON.parse(raw);

        return isStoredTokens(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isStoredTokens(value: unknown): value is StoredTokens {
    if (typeof value !== 'object' || value === null) return false;

    const record = value as Record<string, unknown>;

    return (
        typeof record['accessToken'] === 'string' &&
        typeof record['refreshToken'] === 'string' &&
        Object.values(TokenGrant).includes(record['grant'] as TokenGrant)
    );
}
