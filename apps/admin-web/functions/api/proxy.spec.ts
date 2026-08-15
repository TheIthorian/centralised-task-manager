// @vitest-environment node
//
// Workers matches undici, not jsdom — whose `Request` drops `method` in
// `new Request(url, otherRequest)`.
import { describe, expect, it } from 'vitest';
import { buildProxyRequest, hasAccessAssertion } from './proxy.js';

const adminApiOrigin = 'https://admin-api.example.com';

describe('buildProxyRequest', () => {
    it('strips the /api prefix and swaps the origin', () => {
        const request = new Request('https://ctm-admin.pages.dev/api/metrics');

        expect(buildProxyRequest({ request, adminApiOrigin }).url).toBe('https://admin-api.example.com/metrics');
    });

    it('preserves the query string', () => {
        const request = new Request('https://ctm-admin.pages.dev/api/audit-log?limit=50&skip=100');

        expect(buildProxyRequest({ request, adminApiOrigin }).url).toBe(
            'https://admin-api.example.com/audit-log?limit=50&skip=100',
        );
    });

    it('maps the bare /api root to /', () => {
        const request = new Request('https://ctm-admin.pages.dev/api');

        expect(buildProxyRequest({ request, adminApiOrigin }).url).toBe('https://admin-api.example.com/');
    });

    it('does not strip a path that merely starts with the letters "api"', () => {
        const request = new Request('https://ctm-admin.pages.dev/apiary');

        expect(buildProxyRequest({ request, adminApiOrigin }).url).toBe('https://admin-api.example.com/apiary');
    });

    it('forwards the Access assertion, which is what authenticates the proxied call', () => {
        const request = new Request('https://ctm-admin.pages.dev/api/metrics', {
            headers: { 'Cf-Access-Jwt-Assertion': 'signed.jwt.value' },
        });

        expect(buildProxyRequest({ request, adminApiOrigin }).headers.get('Cf-Access-Jwt-Assertion')).toBe(
            'signed.jwt.value',
        );
    });

    it('forwards the method and body', async () => {
        const request = new Request('https://ctm-admin.pages.dev/api/oauth-clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"clientName":"x"}',
        });
        const proxied = buildProxyRequest({ request, adminApiOrigin });

        expect(proxied.method).toBe('POST');
        expect(await proxied.text()).toBe('{"clientName":"x"}');
    });
});

describe('hasAccessAssertion', () => {
    it('is true when Access stamped the request', () => {
        const request = new Request('https://ctm-admin.pages.dev/api/metrics', {
            headers: { 'Cf-Access-Jwt-Assertion': 'signed.jwt.value' },
        });

        expect(hasAccessAssertion(request)).toBe(true);
    });

    it('is false when the header is missing', () => {
        expect(hasAccessAssertion(new Request('https://ctm-admin.pages.dev/api/metrics'))).toBe(false);
    });

    it('is false when the header is present but empty', () => {
        const request = new Request('https://ctm-admin.pages.dev/api/metrics', {
            headers: { 'Cf-Access-Jwt-Assertion': '' },
        });

        expect(hasAccessAssertion(request)).toBe(false);
    });
});
