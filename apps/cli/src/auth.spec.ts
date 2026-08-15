import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TokenGrant } from '@ctm/api-client';
import { readConfig, readSession, updateStoredTokens, writeConfig, writeSession, clearConfig } from './auth.js';

vi.mock('node:fs');
vi.mock('node:os', () => ({ homedir: () => '/mock-home' }));

const CONFIG_PATH = '/mock-home/.config/ctm/config.json';
const baseUrl = 'http://localhost:3000';

function storedFile(contents: Record<string, unknown>): void {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(contents));
}

function writtenConfig(): Record<string, unknown> {
    return JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('readConfig', () => {
    it('returns null when config file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        expect(readConfig()).toBeNull();
    });

    it('returns the server and client id', () => {
        storedFile({ baseUrl, clientId: 'ctm-cli', accessToken: 'at', refreshToken: 'rt' });

        expect(readConfig()).toEqual({ baseUrl, clientId: 'ctm-cli' });
    });

    it('returns null when config file contains invalid JSON', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('not-json');

        expect(readConfig()).toBeNull();
    });

    it('returns null when the config file has no base URL', () => {
        storedFile({ clientId: 'ctm-cli' });

        expect(readConfig()).toBeNull();
    });
});

describe('readSession', () => {
    it('returns the config and the credentials together', () => {
        storedFile({ baseUrl, accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });

        expect(readSession()).toEqual({ baseUrl, accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });
    });

    it('returns null when the config holds no credentials', () => {
        storedFile({ baseUrl });

        expect(readSession()).toBeNull();
    });

    it('reads a file written before the grant was recorded as the flow that made it', () => {
        storedFile({ baseUrl, clientId: 'ctm-cli', accessToken: 'at', refreshToken: 'rt' });

        expect(readSession()?.grant).toBe(TokenGrant.OAuth);
    });

    it('reads a client-less legacy file as a password login', () => {
        storedFile({ baseUrl, accessToken: 'at', refreshToken: 'rt' });

        expect(readSession()?.grant).toBe(TokenGrant.Session);
    });
});

describe('writeSession', () => {
    it('writes the config and credentials as one file', () => {
        writeSession({ baseUrl, clientId: 'ctm-cli', accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth });

        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(CONFIG_PATH), { recursive: true });
        expect(writtenConfig()).toEqual({
            baseUrl,
            clientId: 'ctm-cli',
            accessToken: 'at',
            refreshToken: 'rt',
            grant: TokenGrant.OAuth,
        });
    });

    it('keeps the file readable only by its owner', () => {
        writeSession({ baseUrl, accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.Session });

        expect(fs.writeFileSync).toHaveBeenCalledWith(CONFIG_PATH, expect.any(String), {
            encoding: 'utf-8',
            mode: 0o600,
        });
        expect(fs.chmodSync).toHaveBeenCalledWith(CONFIG_PATH, 0o600);
    });

    it('rejects a base URL that is not an absolute http(s) URL', () => {
        expect(() =>
            writeSession({ baseUrl: '-D', accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.Session }),
        ).toThrow();
    });
});

describe('updateStoredTokens', () => {
    it('replaces the credentials and keeps the rest of the config', () => {
        storedFile({ baseUrl, clientId: 'ctm-cli', accessToken: 'old', refreshToken: 'old-rt' });

        updateStoredTokens({
            baseUrl,
            tokens: { accessToken: 'new', refreshToken: 'new-rt', grant: TokenGrant.OAuth },
        });

        expect(writtenConfig()).toEqual({
            baseUrl,
            clientId: 'ctm-cli',
            accessToken: 'new',
            refreshToken: 'new-rt',
            grant: TokenGrant.OAuth,
        });
    });
});

describe('writeConfig', () => {
    it('writes config with no credentials in it', () => {
        writeConfig({ baseUrl });

        expect(writtenConfig()).toEqual({ baseUrl });
    });
});

describe('clearConfig', () => {
    it('removes the config file', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        clearConfig();

        expect(fs.rmSync).toHaveBeenCalledWith(CONFIG_PATH);
    });

    it('does nothing if file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        clearConfig();

        expect(fs.rmSync).not.toHaveBeenCalled();
    });
});
