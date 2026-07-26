import { describe, expect, it } from 'vitest';
import { buildRefreshCookieOptions, isWebClient, REFRESH_COOKIE_NAME } from './auth-cookie.js';

describe('isWebClient', () => {
    it('returns true when the proxy header is present', () => {
        expect(isWebClient({ headers: { 'x-ctm-client': 'web' } })).toBe(true);
    });

    it('returns false when the header is absent', () => {
        expect(isWebClient({ headers: {} })).toBe(false);
    });

    it('returns false for any other header value', () => {
        expect(isWebClient({ headers: { 'x-ctm-client': 'cli' } })).toBe(false);
    });
});

describe('buildRefreshCookieOptions', () => {
    it('builds a locked-down cookie', () => {
        const options = buildRefreshCookieOptions({ path: '/api/auth/refresh', secure: true, maxAgeDays: 30 });

        expect(options).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/api/auth/refresh',
            maxAge: 30 * 24 * 60 * 60,
        });
    });

    it('allows insecure cookies for local http development', () => {
        const options = buildRefreshCookieOptions({ path: '/api/auth/refresh', secure: false, maxAgeDays: 1 });

        expect(options.secure).toBe(false);
    });

    it('exposes the cookie name', () => {
        expect(REFRESH_COOKIE_NAME).toBe('ctm_refresh');
    });
});

describe('COOKIE_PATH path-match invariant', () => {
    // app.inject() sets the Cookie header directly and ignores Path entirely, so it
    // cannot catch a COOKIE_PATH that is too narrow for the logout route. A real
    // browser only sends a cookie when its Path is a path-prefix of the request path
    // (RFC 6265 §5.1.4). Assert that invariant here against the configured value.
    it('is a path-prefix of both /api/auth/refresh and /api/auth/logout', () => {
        const configuredPath = process.env['COOKIE_PATH'];

        expect(configuredPath).toBeTruthy();

        for (const route of ['/api/auth/refresh', '/api/auth/logout']) {
            const isPrefix = route === configuredPath || route.startsWith(`${configuredPath}/`);

            expect(isPrefix, `COOKIE_PATH=${configuredPath} does not path-match ${route}`).toBe(true);
        }
    });
});
