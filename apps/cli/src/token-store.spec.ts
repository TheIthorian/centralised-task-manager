import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Entry } from '@napi-rs/keyring';
import { ConfigurationError } from '@ctm/errors';
import { TokenGrant, TokenStoreBackend, activeBackend, clearTokens, readTokens, writeTokens } from './token-store.js';

const getPassword = vi.fn<() => string | null>();
const setPassword = vi.fn();
const deletePassword = vi.fn();

vi.mock('@napi-rs/keyring', () => ({
    Entry: vi.fn(function MockEntry() {
        return { getPassword, setPassword, deletePassword };
    }),
}));

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
    it('uses the OS keyring by default', () => {
        expect(activeBackend()).toBe(TokenStoreBackend.Keyring);
    });

    it('uses the plain file only when explicitly asked', () => {
        process.env['CTM_TOKEN_STORE'] = 'file';

        expect(activeBackend()).toBe(TokenStoreBackend.File);
    });
});

describe('readTokens', () => {
    it('returns the stored token set', () => {
        getPassword.mockReturnValue(JSON.stringify(tokens));

        expect(readTokens({ baseUrl })).toEqual(tokens);
    });

    it('returns null when the keyring holds nothing for this base URL', () => {
        getPassword.mockReturnValue(null);

        expect(readTokens({ baseUrl })).toBeNull();
    });

    it('says the entry is unreadable rather than reporting no login', () => {
        getPassword.mockReturnValue(JSON.stringify({ accessToken: 'at' }));

        expect(() => readTokens({ baseUrl })).toThrow(ConfigurationError);
    });

    it('says the same for an entry that is not JSON at all', () => {
        getPassword.mockReturnValue('Mbcxabs3');

        expect(() => readTokens({ baseUrl })).toThrow(ConfigurationError);
    });
});

describe('writeTokens', () => {
    it('keys the entry by service and base URL', () => {
        writeTokens({ baseUrl, tokens });

        expect(Entry).toHaveBeenCalledWith('ctm', baseUrl);
        expect(setPassword).toHaveBeenCalledWith(JSON.stringify(tokens));
    });

    it('keys a trailing-slash URL the same as one without', () => {
        writeTokens({ baseUrl: `${baseUrl}/`, tokens });

        expect(Entry).toHaveBeenCalledWith('ctm', baseUrl);
    });

    it('refuses a base URL that is not an absolute http(s) URL', () => {
        expect(() => writeTokens({ baseUrl: '-D', tokens })).toThrow(ConfigurationError);
        expect(setPassword).not.toHaveBeenCalled();
    });
});

describe('clearTokens', () => {
    it('deletes the entry for that base URL', () => {
        clearTokens({ baseUrl });

        expect(Entry).toHaveBeenCalledWith('ctm', baseUrl);
        expect(deletePassword).toHaveBeenCalled();
    });
});
