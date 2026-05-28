import { describe, it, expect } from 'vitest';
import { isRedirectUriPermitted } from './oauth-client.service.js';

describe('isRedirectUriPermitted', () => {
    it('exact-matches non-loopback URIs', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://example.com/callback')).toBe(true);
    });

    it('rejects non-loopback URI not in registered list', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://other.com/callback')).toBe(false);
    });

    it('rejects non-loopback URIs that differ only in port', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://example.com:8080/callback')).toBe(
            false,
        );
    });

    it('allows loopback 127.0.0.1 with any port', () => {
        expect(isRedirectUriPermitted(['http://127.0.0.1'], 'http://127.0.0.1:52345/callback')).toBe(true);
    });

    it('allows loopback localhost with any port', () => {
        expect(isRedirectUriPermitted(['http://localhost'], 'http://localhost:12345/callback')).toBe(true);
    });

    it('allows loopback ::1 with any port', () => {
        expect(isRedirectUriPermitted(['http://[::1]'], 'http://[::1]:9999/callback')).toBe(true);
    });

    it('rejects loopback URI with mismatched scheme', () => {
        expect(isRedirectUriPermitted(['http://127.0.0.1'], 'https://127.0.0.1:52345/callback')).toBe(false);
    });

    it('returns true if any registered URI matches', () => {
        expect(
            isRedirectUriPermitted(
                ['https://example.com/callback', 'http://127.0.0.1'],
                'http://127.0.0.1:9876/callback',
            ),
        ).toBe(true);
    });

    it('returns false for empty registered list', () => {
        expect(isRedirectUriPermitted([], 'http://127.0.0.1:1234/callback')).toBe(false);
    });
});
