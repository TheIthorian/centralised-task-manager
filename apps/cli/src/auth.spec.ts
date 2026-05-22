import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readConfig, writeConfig, clearConfig } from './auth.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('node:fs');
vi.mock('node:os', () => ({ homedir: () => '/mock-home' }));

const CONFIG_PATH = '/mock-home/.config/ctm/config.json';

describe('readConfig', () => {
    it('returns null when config file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(readConfig()).toBeNull();
    });

    it('returns parsed config when file exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            JSON.stringify({ accessToken: 'at', refreshToken: 'rt', baseUrl: 'http://localhost:3000' }),
        );
        expect(readConfig()).toEqual({ accessToken: 'at', refreshToken: 'rt', baseUrl: 'http://localhost:3000' });
    });

    it('returns null when config file contains invalid JSON', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('not-json');
        expect(readConfig()).toBeNull();
    });

    it('returns null when config file is missing required fields', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ accessToken: 'at' }));
        expect(readConfig()).toBeNull();
    });
});

describe('writeConfig', () => {
    it('creates directory and writes JSON', () => {
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
        writeConfig({ accessToken: 'at', refreshToken: 'rt', baseUrl: 'http://localhost:3000' });
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(CONFIG_PATH), { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            CONFIG_PATH,
            JSON.stringify({ accessToken: 'at', refreshToken: 'rt', baseUrl: 'http://localhost:3000' }, null, 2),
            'utf-8',
        );
    });
});

describe('clearConfig', () => {
    it('removes config file if it exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.rmSync).mockImplementation(() => undefined);
        clearConfig();
        expect(fs.rmSync).toHaveBeenCalledWith(CONFIG_PATH);
    });

    it('does nothing if file does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        clearConfig();
        expect(fs.rmSync).not.toHaveBeenCalled();
    });
});
