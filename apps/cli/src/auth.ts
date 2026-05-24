import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InternalError } from '@ctm/errors';

/** Credentials and API base URL persisted to ~/.config/ctm/config.json. */
export type CliConfig = {
    accessToken: string;
    refreshToken: string;
    baseUrl: string;
};

const CONFIG_PATH = path.join(os.homedir(), '.config', 'ctm', 'config.json');

function isCliConfig(value: unknown): value is CliConfig {
    return (
        typeof value === 'object' &&
        value !== null &&
        'accessToken' in value &&
        'refreshToken' in value &&
        'baseUrl' in value &&
        typeof (value as Record<string, unknown>)['accessToken'] === 'string' &&
        typeof (value as Record<string, unknown>)['refreshToken'] === 'string' &&
        typeof (value as Record<string, unknown>)['baseUrl'] === 'string'
    );
}

/** Read stored CLI config, or null if not present. */
export function readConfig(): CliConfig | null {
    if (!fs.existsSync(CONFIG_PATH)) return null;

    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        return isCliConfig(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Write config to disk, creating parent dirs as needed. */
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

/** Delete config file if present. */
export function clearConfig(): void {
    if (fs.existsSync(CONFIG_PATH)) {
        fs.rmSync(CONFIG_PATH);
    }
}
