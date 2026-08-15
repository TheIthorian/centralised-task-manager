import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readConfig, readSession, writeConfig, writeSession, clearConfig } from './auth.js';
import { TokenGrant, clearTokens, readTokens, writeTokens } from './token-store.js';

vi.mock('node:fs');
vi.mock('node:os', () => ({ homedir: () => '/mock-home' }));
vi.mock('./token-store.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./token-store.js')>()),
    readTokens: vi.fn(),
    writeTokens: vi.fn(),
    clearTokens: vi.fn(),
}));

const CONFIG_PATH = '/mock-home/.config/ctm/config.json';
const baseUrl = 'http://localhost:3000';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('readConfig', () => {
    it('returns null when config file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        expect(readConfig()).toBeNull();
    });

    it('returns the non-secret config when the file exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ baseUrl, clientId: 'ctm-cli' }));

        expect(readConfig()).toEqual({ baseUrl, clientId: 'ctm-cli' });
    });

    it('returns null when config file contains invalid JSON', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('not-json');

        expect(readConfig()).toBeNull();
    });

    it('returns null when the config file has no base URL', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ clientId: 'ctm-cli' }));

        expect(readConfig()).toBeNull();
    });
});

describe('readSession', () => {
    it('combines config with tokens from the secret store', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ baseUrl }));
        vi.mocked(readTokens).mockReturnValue({ accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });

        expect(readSession()).toEqual({ baseUrl, accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });
    });

    it('returns null when nothing is stored for the base URL', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ baseUrl }));
        vi.mocked(readTokens).mockReturnValue(null);

        expect(readSession()).toBeNull();
    });

    it('ignores tokens left in the config file by an older CLI', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ baseUrl, accessToken: 'legacy-at', refreshToken: 'legacy-rt' }),
        );
        vi.mocked(readTokens).mockReturnValue(null);

        expect(readSession()).toBeNull();
    });
});

describe('writeSession', () => {
    it('puts the tokens in the secret store and only the rest on disk', () => {
        writeSession({ baseUrl, clientId: 'ctm-cli', accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });

        expect(writeTokens).toHaveBeenCalledWith({
            baseUrl,
            tokens: { accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth },
        });
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(CONFIG_PATH), { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            CONFIG_PATH,
            JSON.stringify({ baseUrl, clientId: 'ctm-cli' }, null, 2),
            'utf-8',
        );
    });

    it('never writes a token to the config file', () => {
        writeSession({ baseUrl, accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.Session });

        const written = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;

        expect(written).not.toContain('at');
        expect(written).not.toContain('rt');
    });
});

describe('writeConfig', () => {
    it('creates directory and writes JSON', () => {
        writeConfig({ baseUrl });

        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(CONFIG_PATH), { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith(CONFIG_PATH, JSON.stringify({ baseUrl }, null, 2), 'utf-8');
    });
});

describe('clearConfig', () => {
    it('removes the config file and the stored tokens', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ baseUrl }));

        clearConfig();

        expect(clearTokens).toHaveBeenCalledWith({ baseUrl });
        expect(fs.rmSync).toHaveBeenCalledWith(CONFIG_PATH);
    });

    it('does nothing if file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        clearConfig();

        expect(fs.rmSync).not.toHaveBeenCalled();
    });
});
