// @vitest-environment node
//
// The Pages Function this file tests runs in Cloudflare's Workers runtime, not a
// browser/DOM — its `fetch`/`Request` semantics match Node's (undici), not jsdom's.
// jsdom's `Request` polyfill drops `method` when constructing `new Request(url,
// otherRequest)` (verified against plain Node/undici, where it is preserved
// correctly), so this suite opts out of the package's default jsdom environment.
import { describe, expect, it } from 'vitest';
import { buildProxyRequest } from './proxy.js';

const apiOrigin = 'https://api.example.com';

describe('buildProxyRequest', () => {
    it('strips the /api prefix and swaps the origin', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/tasks');
    });

    it('preserves the query string', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks?filter=today&page=2');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/tasks?filter=today&page=2');
    });

    it('maps the bare /api root to /', () => {
        const request = new Request('https://ctm-web.pages.dev/api');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/');
    });

    it('maps /api/ (trailing slash) to /', () => {
        const request = new Request('https://ctm-web.pages.dev/api/');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/');
    });

    it('does not strip a path that merely starts with the letters "api"', () => {
        const request = new Request('https://ctm-web.pages.dev/apiary');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/apiary');
    });

    it('does not strip /api-status, which is not the /api segment', () => {
        const request = new Request('https://ctm-web.pages.dev/api-status');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/api-status');
    });

    it('stamps the web client header', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.headers.get('X-Ctm-Client')).toBe('web');
    });

    it('overwrites a spoofed client header', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks', {
            headers: { 'X-Ctm-Client': 'cli' },
        });
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.headers.get('X-Ctm-Client')).toBe('web');
    });

    it('forwards the method, body, and cookies', async () => {
        const request = new Request('https://ctm-web.pages.dev/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: 'ctm_refresh=abc' },
            body: '{}',
        });
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.method).toBe('POST');
        expect(proxied.headers.get('Cookie')).toBe('ctm_refresh=abc');
        expect(await proxied.text()).toBe('{}');
    });

    it('forwards a WebSocket upgrade request with its Upgrade/Connection headers intact', () => {
        const request = new Request('https://ctm-web.pages.dev/api/socket.io/?EIO=4&transport=websocket', {
            headers: {
                Upgrade: 'websocket',
                Connection: 'Upgrade',
                'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Version': '13',
            },
        });
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/socket.io/?EIO=4&transport=websocket');
        expect(proxied.headers.get('Upgrade')).toBe('websocket');
        expect(proxied.headers.get('Connection')).toBe('Upgrade');
        expect(proxied.headers.get('Sec-WebSocket-Key')).toBe('dGhlIHNhbXBsZSBub25jZQ==');
        expect(proxied.headers.get('Sec-WebSocket-Version')).toBe('13');
    });
});
