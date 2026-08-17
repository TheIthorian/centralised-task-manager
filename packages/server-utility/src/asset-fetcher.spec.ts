import { describe, it, expect, vi } from 'vitest';
import { AssetFetcher, AssetRejection, type HostResolver } from './asset-fetcher.js';

const PUBLIC_ADDRESS = '93.184.216.34';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

describe('AssetFetcher', () => {
    it('returns the body, media type and final URI', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png; charset=utf-8' })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({
            ok: true,
            asset: {
                body: Buffer.from('bytes'),
                contentType: 'image/png',
                finalUri: 'https://cdn.example.com/logo.png',
            },
        });
    });

    it('refuses a host that resolves to a private address, without requesting it', async () => {
        const fetchImpl = vi.fn();
        const fetcher = new AssetFetcher({
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: async () => ['10.0.0.5'],
        });

        const result = await fetcher.fetchAsset({ uri: 'https://internal.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses a host that resolves to a mix of public and private addresses', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: async () => [PUBLIC_ADDRESS, '127.0.0.1'],
        });

        const result = await fetcher.fetchAsset({ uri: 'https://mixed.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
    });

    it.each([
        ['http', 'http://cdn.example.com/logo.png'],
        ['file', 'file:///etc/passwd'],
        ['data', 'data:image/png;base64,AAAA'],
        ['relative', '/logo.png'],
    ])('refuses a %s URI', async (_label, uri) => {
        const fetcher = new AssetFetcher({
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(await fetcher.fetchAsset({ uri })).toEqual({ ok: false, rejection: AssetRejection.UriNotAllowed });
    });

    it('accepts a scheme the caller allows', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png' })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({
            uri: 'http://cdn.example.com/logo.png',
            allowedSchemes: ['http:', 'https:'],
        });

        expect(result.ok).toBe(true);
    });

    it('follows a redirect to another public host', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(redirectTo('https://images.example.net/logo.png'))
            .mockResolvedValueOnce(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png' }));

        const fetcher = new AssetFetcher({
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result.ok).toBe(true);
        expect(result.ok && result.asset.finalUri).toBe('https://images.example.net/logo.png');
    });

    it('refuses a redirect into a private address', async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(redirectTo('https://internal.example.com/logo.png'));
        const fetcher = new AssetFetcher({
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: async (hostname) =>
                hostname === 'internal.example.com' ? ['169.254.169.254'] : [PUBLIC_ADDRESS],
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gives up on a redirect loop', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(redirectTo('https://cdn.example.com/logo.png'));
        const fetcher = new AssetFetcher({
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxRedirects: 2 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooManyRedirects });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('refuses a content type the caller does not accept', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(assetResponse({ body: Buffer.from('<html>'), contentType: 'text/html' })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({
            uri: 'https://cdn.example.com/logo.png',
            allowedContentTypes: IMAGE_TYPES,
        });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.ContentTypeNotAllowed });
    });

    it('refuses a response whose declared length exceeds the cap', async () => {
        const response = assetResponse({ body: Buffer.alloc(16), contentType: 'image/png' });

        response.headers.set('content-length', '2048');

        const fetcher = new AssetFetcher({
            fetchImpl: responder(response),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxBytes: 1024 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooLarge });
    });

    it('refuses a body that exceeds the cap without declaring its length', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(assetResponse({ body: Buffer.alloc(2048), contentType: 'image/png' })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxBytes: 1024 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooLarge });
    });

    it('reports a non-2xx response', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(new Response('', { status: 404 })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.NotOk });
    });

    it('reports a host that cannot be reached', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.Unreachable });
    });

    it('reports a host that does not resolve', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: async () => {
                throw new Error('ENOTFOUND');
            },
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
    });

    it('applies the limits given to the constructor', async () => {
        const fetcher = new AssetFetcher({
            fetchImpl: responder(assetResponse({ body: Buffer.alloc(64), contentType: 'image/png' })),
            resolveHost: publicResolver(),
            defaults: { maxBytes: 32 },
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooLarge });
    });
});

function publicResolver(): HostResolver {
    return async () => [PUBLIC_ADDRESS];
}

function assetResponse({ body, contentType }: { body: Buffer; contentType: string }): Response {
    return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': contentType } });
}

function responder(response: Response): typeof fetch {
    return (() => Promise.resolve(response)) as unknown as typeof fetch;
}

function redirectTo(location: string): Response {
    return new Response('', { status: 302, headers: { location } });
}
