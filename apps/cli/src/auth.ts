import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type CliConfig = {
    accessToken: string;
    refreshToken: string;
    baseUrl: string;
};

const CONFIG_PATH = path.join(os.homedir(), '.config', 'ctm', 'config.json');

/** Read stored CLI config, or null if not present. */
export function readConfig(): CliConfig | null {
    if (!fs.existsSync(CONFIG_PATH)) return null;

    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(raw) as CliConfig;
    } catch {
        return null;
    }
}

/** Write config to disk, creating parent dirs as needed. */
export function writeConfig(config: CliConfig): void {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/** Delete config file if present. */
export function clearConfig(): void {
    if (fs.existsSync(CONFIG_PATH)) {
        fs.rmSync(CONFIG_PATH);
    }
}
