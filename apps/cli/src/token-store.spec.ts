import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { ConfigurationError } from '@ctm/errors';
import { TokenGrant, TokenStoreBackend, activeBackend, readTokens, writeTokens } from './token-store.js';

vi.mock('node:child_process');
vi.mock('node:os', () => ({ homedir: () => '/mock-home' }));

const baseUrl = 'http://localhost:3000';
const tokens = { accessToken: 'at', refreshToken: 'rt', grant: TokenGrant.OAuth };

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['CTM_TOKEN_STORE'];
});

afterEach(() => {
    delete process.env['CTM_TOKEN_STORE'];
});

describe('activeBackend', () => {
    it('uses the plain file only when explicitly asked', () => {
        process.env['CTM_TOKEN_STORE'] = 'file';

        expect(activeBackend()).toBe(TokenStoreBackend.File);
    });

    it('picks a real secret store by default', () => {
        expect(activeBackend()).not.toBe(TokenStoreBackend.File);
    });
});

describe('readTokens', () => {
    it('returns the stored token set', () => {
        vi.mocked(execFileSync).mockReturnValue(JSON.stringify(tokens));

        expect(readTokens({ baseUrl })).toEqual(tokens);
    });

    it('returns null when the store holds nothing for this base URL', () => {
        vi.mocked(execFileSync).mockImplementation(() => {
            throw Object.assign(new Error('not found'), { status: 44 });
        });

        expect(readTokens({ baseUrl })).toBeNull();
    });

    it('returns null when the stored value is not a token set', () => {
        vi.mocked(execFileSync).mockReturnValue(JSON.stringify({ accessToken: 'at' }));

        expect(readTokens({ baseUrl })).toBeNull();
    });

    it('explains what to install when the platform tool is missing', () => {
        vi.mocked(execFileSync).mockImplementation(() => {
            throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
        });

        expect(() => readTokens({ baseUrl })).toThrow(ConfigurationError);
    });
});

describe('writeTokens', () => {
    it('hands the secret to the platform tool, keyed by base URL', () => {
        vi.mocked(execFileSync).mockReturnValue('');

        writeTokens({ baseUrl, tokens });

        const [, args] = vi.mocked(execFileSync).mock.calls[0]!;

        expect(args).toContain(baseUrl);
    });
});
