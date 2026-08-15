import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TokenGrant } from '@ctm/api-client';
import { ConfigurationError, InternalError } from '@ctm/errors';
import { normalizeBaseUrl } from './base-url.js';

/** The secret half of the CLI's credentials. Never written to the config file. */
export type StoredTokens = {
    accessToken: string;
    refreshToken: string;
    grant: TokenGrant;
};

export { TokenGrant };

/** Backends the CLI knows how to talk to. `file` is opt-in and unencrypted on macOS and Linux. */
export enum TokenStoreBackend {
    MacosKeychain = 'macos-keychain',
    Libsecret = 'libsecret',
    WindowsDpapi = 'windows-dpapi',
    File = 'file',
}

const SERVICE = 'ctm';
const FILE_STORE_PATH = path.join(os.homedir(), '.config', 'ctm', 'credentials.json');

/**
 * Read the tokens stored for a base URL, or null when nothing is stored.
 *
 * @throws ConfigurationError when the platform's secret store is unavailable.
 */
export function readTokens({ baseUrl }: { baseUrl: string }): StoredTokens | null {
    const raw = readSecret({ account: normalizeBaseUrl(baseUrl) });

    if (raw === null) return null;

    const parsed = parseTokens(raw);

    // Something else owns this entry, or an interrupted write left it half-formed. Either way the
    // user cannot act on "not logged in" when the store plainly holds an entry for this server.
    if (parsed === null) {
        throw new ConfigurationError(
            `The credentials stored for ${normalizeBaseUrl(baseUrl)} are not readable. Run \`ctm login\` to replace them.`,
        );
    }

    return parsed;
}

/**
 * Store tokens for a base URL, replacing anything already held.
 *
 * @throws ConfigurationError when the platform's secret store is unavailable.
 */
export function writeTokens({ baseUrl, tokens }: { baseUrl: string; tokens: StoredTokens }): void {
    writeSecret({ account: normalizeBaseUrl(baseUrl), secret: JSON.stringify(tokens) });
}

/** Remove stored tokens for a base URL. No-op when nothing is stored. */
export function clearTokens({ baseUrl }: { baseUrl: string }): void {
    deleteSecret({ account: normalizeBaseUrl(baseUrl) });
}

/**
 * The backend in use. `CTM_TOKEN_STORE=file` forces the plain file, for CI and headless boxes
 * where no secret service is running; there is no silent fallback, so a broken keychain is an
 * error the user sees rather than a credential quietly written to disk in the clear.
 */
export function activeBackend(): TokenStoreBackend {
    if (process.env['CTM_TOKEN_STORE'] === 'file') return TokenStoreBackend.File;

    switch (process.platform) {
        case 'darwin':
            return TokenStoreBackend.MacosKeychain;
        case 'win32':
            return TokenStoreBackend.WindowsDpapi;
        default:
            return TokenStoreBackend.Libsecret;
    }
}

function readSecret({ account }: { account: string }): string | null {
    switch (activeBackend()) {
        case TokenStoreBackend.MacosKeychain:
            // Exit code 44 is "item not found", which is a miss rather than a failure.
            return run({
                command: 'security',
                args: ['find-generic-password', '-s', SERVICE, '-a', account, '-w'],
                allowedFailureCodes: [44],
            });
        case TokenStoreBackend.Libsecret:
            return (
                run({
                    command: 'secret-tool',
                    args: ['lookup', 'service', SERVICE, 'account', account],
                    allowedFailureCodes: [1],
                }) || null
            );
        case TokenStoreBackend.WindowsDpapi:
            return readDpapiFile({ account });
        case TokenStoreBackend.File:
            return readFileStore({ account });
    }
}

function writeSecret({ account, secret }: { account: string; secret: string }): void {
    switch (activeBackend()) {
        case TokenStoreBackend.MacosKeychain:
            // `-U` updates in place. `-w` with no value reads the secret from stdin, twice for
            // the confirmation prompt, which keeps it off argv where any process could read it.
            run({
                command: 'security',
                args: ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-w'],
                stdin: `${secret}\n${secret}\n`,
            });

            return;
        case TokenStoreBackend.Libsecret:
            run({
                command: 'secret-tool',
                args: ['store', '--label', `${SERVICE} (${account})`, 'service', SERVICE, 'account', account],
                stdin: secret,
            });

            return;
        case TokenStoreBackend.WindowsDpapi:
            writeDpapiFile({ account, secret });

            return;
        case TokenStoreBackend.File:
            writeFileStore({ account, secret });

            return;
    }
}

function deleteSecret({ account }: { account: string }): void {
    switch (activeBackend()) {
        case TokenStoreBackend.MacosKeychain:
            run({
                command: 'security',
                args: ['delete-generic-password', '-s', SERVICE, '-a', account],
                allowedFailureCodes: [44],
            });

            return;
        case TokenStoreBackend.Libsecret:
            run({
                command: 'secret-tool',
                args: ['clear', 'service', SERVICE, 'account', account],
                allowedFailureCodes: [1],
            });

            return;
        case TokenStoreBackend.WindowsDpapi:
        case TokenStoreBackend.File:
            removeFromFileStore({ account });

            return;
    }
}

/**
 * Windows has no command that reads an arbitrary secret back out of Credential Manager, so the
 * blob is encrypted with user-scoped DPAPI and kept in a file only this user's account can decrypt.
 */
function writeDpapiFile({ account, secret }: { account: string; secret: string }): void {
    const encrypted = runPowerShell({
        script: '$plain = [Console]::In.ReadToEnd(); ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString',
        stdin: secret,
    });

    writeFileStore({ account, secret: encrypted });
}

function readDpapiFile({ account }: { account: string }): string | null {
    const encrypted = readFileStore({ account });

    if (encrypted === null) return null;

    return runPowerShell({
        script: '$enc = [Console]::In.ReadToEnd().Trim(); $sec = ConvertTo-SecureString $enc; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))',
        stdin: encrypted,
    });
}

function readFileStore({ account }: { account: string }): string | null {
    if (!fs.existsSync(FILE_STORE_PATH)) return null;

    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(FILE_STORE_PATH, 'utf-8'));

        if (typeof parsed !== 'object' || parsed === null) return null;

        const value = (parsed as Record<string, unknown>)[account];

        return typeof value === 'string' ? value : null;
    } catch {
        return null;
    }
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

function runPowerShell({ script, stdin }: { script: string; stdin: string }): string {
    return run({ command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script], stdin }) ?? '';
}

function run({
    command,
    args,
    stdin,
    allowedFailureCodes = [],
}: {
    command: string;
    args: string[];
    stdin?: string;
    allowedFailureCodes?: number[];
}): string | null {
    try {
        const output = execFileSync(command, args, {
            encoding: 'utf-8',
            input: stdin,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        return output.replace(/\r?\n$/, '');
    } catch (err: unknown) {
        const status = (err as { status?: number }).status;

        if (typeof status === 'number' && allowedFailureCodes.includes(status)) return null;

        if ((err as { code?: string }).code === 'ENOENT') {
            throw new ConfigurationError(
                `${command} is not available, so the CLI cannot reach this system's secret store. ` +
                    'Install it, or set CTM_TOKEN_STORE=file to keep credentials in a plain file.',
            );
        }

        throw new InternalError(
            `${command} failed while accessing the secret store: ${err instanceof Error ? err.message : String(err)}`,
        );
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
