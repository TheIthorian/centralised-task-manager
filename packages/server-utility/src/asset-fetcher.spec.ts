import { Readable } from 'node:stream';
import { describe, it, expect, vi } from 'vitest';
import { ExternalServiceError } from '@ctm/errors';
import { disposableStream, type HttpClient, type StreamResponse } from '@ctm/http-client';
import { AssetFetcher, AssetRejection, type HostResolver } from './asset-fetcher.js';

const PUBLIC_ADDRESS = '93.184.216.34';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

describe('AssetFetcher', () => {
    it('returns the body, media type and final URI', async () => {
        const fetcher = new AssetFetcher({
            http: respondingWith(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png; charset=utf-8' })),
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
        const getStream = vi.fn();
        const fetcher = new AssetFetcher({
            http: { getStream } as unknown as HttpClient,
            resolveHost: async () => ['10.0.0.5'],
        });

        const result = await fetcher.fetchAsset({ uri: 'https://internal.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
        expect(getStream).not.toHaveBeenCalled();
    });

    it('refuses a host that resolves to a mix of public and private addresses', async () => {
        const fetcher = new AssetFetcher({
            http: { getStream: vi.fn() } as unknown as HttpClient,
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
            http: { getStream: vi.fn() } as unknown as HttpClient,
            resolveHost: publicResolver(),
        });

        expect(await fetcher.fetchAsset({ uri })).toEqual({ ok: false, rejection: AssetRejection.UriNotAllowed });
    });

    it('accepts a scheme the caller allows', async () => {
        const fetcher = new AssetFetcher({
            http: respondingWith(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png' })),
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({
            uri: 'http://cdn.example.com/logo.png',
            allowedSchemes: ['http:', 'https:'],
        });

        expect(result.ok).toBe(true);
    });

    it('follows a redirect to another public host', async () => {
        const getStream = vi
            .fn()
            .mockResolvedValueOnce(redirectTo('https://images.example.net/logo.png'))
            .mockResolvedValueOnce(assetResponse({ body: Buffer.from('bytes'), contentType: 'image/png' }));

        const fetcher = new AssetFetcher({
            http: { getStream } as unknown as HttpClient,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result.ok).toBe(true);
        expect(result.ok && result.asset.finalUri).toBe('https://images.example.net/logo.png');
    });

    it('refuses a redirect into a private address', async () => {
        const getStream = vi.fn().mockResolvedValueOnce(redirectTo('https://internal.example.com/logo.png'));
        const fetcher = new AssetFetcher({
            http: { getStream } as unknown as HttpClient,
            resolveHost: async (hostname) =>
                hostname === 'internal.example.com' ? ['169.254.169.254'] : [PUBLIC_ADDRESS],
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
        expect(getStream).toHaveBeenCalledTimes(1);
    });

    it('gives up on a redirect loop', async () => {
        const getStream = vi.fn().mockImplementation(async () => redirectTo('https://cdn.example.com/logo.png'));
        const fetcher = new AssetFetcher({
            http: { getStream } as unknown as HttpClient,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxRedirects: 2 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooManyRedirects });
        expect(getStream).toHaveBeenCalledTimes(3);
    });

    it('refuses a content type the caller does not accept', async () => {
        const response = assetResponse({ body: Buffer.from('<html>'), contentType: 'text/html' });
        const fetcher = new AssetFetcher({ http: respondingWith(response), resolveHost: publicResolver() });

        const result = await fetcher.fetchAsset({
            uri: 'https://cdn.example.com/logo.png',
            allowedContentTypes: IMAGE_TYPES,
        });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.ContentTypeNotAllowed });
        expect(response.body.destroyed).toBe(true);
    });

    it('refuses a response whose declared length exceeds the cap, without reading it', async () => {
        const response = assetResponse({ body: Buffer.alloc(16), contentType: 'image/png' });

        response.headers['content-length'] = '2048';

        const fetcher = new AssetFetcher({ http: respondingWith(response), resolveHost: publicResolver() });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxBytes: 1024 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooLarge });
        expect(response.body.destroyed).toBe(true);
    });

    it('refuses a body that exceeds the cap without declaring its length', async () => {
        const response = assetResponse({ body: Buffer.alloc(2048), contentType: 'image/png' });
        const fetcher = new AssetFetcher({ http: respondingWith(response), resolveHost: publicResolver() });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png', maxBytes: 1024 });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.TooLarge });
        expect(response.body.destroyed).toBe(true);
    });

    it('reports a non-2xx response and closes its body', async () => {
        const response: StreamResponse = { status: 404, headers: {}, body: disposableStream(Readable.from([])) };
        const fetcher = new AssetFetcher({ http: respondingWith(response), resolveHost: publicResolver() });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.NotOk });
        expect(response.body.destroyed).toBe(true);
    });

    it('reports a host that cannot be reached', async () => {
        const fetcher = new AssetFetcher({
            http: {
                getStream: async (): Promise<StreamResponse> => {
                    throw new ExternalServiceError('https://cdn.example.com/logo.png', 'ECONNREFUSED');
                },
            } as unknown as HttpClient,
            resolveHost: publicResolver(),
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.Unreachable });
    });

    it('reports a host that does not resolve', async () => {
        const fetcher = new AssetFetcher({
            http: { getStream: vi.fn() } as unknown as HttpClient,
            resolveHost: async () => {
                throw new Error('ENOTFOUND');
            },
        });

        const result = await fetcher.fetchAsset({ uri: 'https://cdn.example.com/logo.png' });

        expect(result).toEqual({ ok: false, rejection: AssetRejection.HostNotAllowed });
    });

    it('applies the limits given to the constructor', async () => {
        const fetcher = new AssetFetcher({
            http: respondingWith(assetResponse({ body: Buffer.alloc(64), contentType: 'image/png' })),
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

function assetResponse({ body, contentType }: { body: Buffer; contentType: string }): StreamResponse {
    return { status: 200, headers: { 'content-type': contentType }, body: disposableStream(Readable.from([body])) };
}

function redirectTo(location: string): StreamResponse {
    return { status: 302, headers: { location }, body: disposableStream(Readable.from([])) };
}

function respondingWith(response: StreamResponse): HttpClient {
    return { getStream: async (): Promise<StreamResponse> => response } as unknown as HttpClient;
}
