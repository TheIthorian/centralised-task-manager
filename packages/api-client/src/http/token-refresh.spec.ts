import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenRefresher, isExpiring } from './token-refresh.js';
import { TokenGrant } from './http.types.js';

const baseUrl = 'http://localhost:3000';

function tokenExpiringIn(seconds: number): string {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `header.${payload}.signature`;
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('isExpiring', () => {
    it('is false for a token with plenty of life left', () => {
        expect(isExpiring(tokenExpiringIn(120))).toBe(false);
    });

    it('is true inside the refresh leeway', () => {
        expect(isExpiring(tokenExpiringIn(10))).toBe(true);
    });

    it('is true for an already expired token', () => {
        expect(isExpiring(tokenExpiringIn(-10))).toBe(true);
    });

    it('is true for a token whose expiry cannot be read', () => {
        expect(isExpiring('not-a-jwt')).toBe(true);
    });
});

describe('TokenRefresher', () => {
    it('returns the current token untouched while it is still good', async () => {
        const accessToken = tokenExpiringIn(120);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken, refreshToken: 'rt', grant: TokenGrant.Session },
        });

        expect(await refresher.accessToken()).toBe(accessToken);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('redeems an OAuth refresh token at the token endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'new-at', refresh_token: 'new-rt' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(5), refreshToken: 'rt', grant: TokenGrant.OAuth },
        });

        expect(await refresher.accessToken()).toBe('new-at');
        expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/oauth/token`, expect.objectContaining({ method: 'POST' }));
    });

    it('redeems a session refresh token at the auth endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ accessToken: 'new-at', refreshToken: 'new-rt' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(5), refreshToken: 'rt', grant: TokenGrant.Session },
        });

        expect(await refresher.accessToken()).toBe('new-at');
        expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/auth/refresh`, expect.objectContaining({ method: 'POST' }));
    });

    it('hands the rotated pair to the injected persistence', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ access_token: 'new-at', refresh_token: 'new-rt' }),
            }),
        );
        const onTokensRefreshed = vi.fn();

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(5), refreshToken: 'rt', grant: TokenGrant.OAuth },
            persistence: { onTokensRefreshed },
        });

        await refresher.accessToken();

        expect(onTokensRefreshed).toHaveBeenCalledWith({
            accessToken: 'new-at',
            refreshToken: 'new-rt',
            grant: TokenGrant.OAuth,
        });
    });

    it('keeps a session refresh token that came back only as a cookie', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'new-at' }) }),
        );
        const onTokensRefreshed = vi.fn();

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(5), refreshToken: 'rt', grant: TokenGrant.Session },
            persistence: { onTokensRefreshed },
        });

        await refresher.accessToken();

        expect(onTokensRefreshed).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'rt' }));
    });

    it('exchanges once when concurrent callers race, since the token is single-use', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'new-at', refresh_token: 'new-rt' }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(-5), refreshToken: 'rt', grant: TokenGrant.OAuth },
        });

        await Promise.all([refresher.accessToken(), refresher.accessToken(), refresher.accessToken()]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to the current token when the refresh fails', async () => {
        const accessToken = tokenExpiringIn(5);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken, refreshToken: 'rt', grant: TokenGrant.OAuth },
        });

        expect(await refresher.accessToken()).toBe(accessToken);
    });

    it('does not attempt a refresh without a refresh token', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const refresher = new TokenRefresher({
            baseUrl,
            tokens: { accessToken: tokenExpiringIn(-5), refreshToken: null, grant: TokenGrant.Session },
        });

        await refresher.accessToken();

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
