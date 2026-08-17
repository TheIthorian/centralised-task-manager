import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import {
    fetchClientLogo,
    LOGO_CONTENT_TYPE,
    LOGO_SIZE_PX,
    MAX_LOGO_BYTES,
    MAX_LOGO_REDIRECTS,
    type HostResolver,
} from './client-logo.fetcher.js';

const PUBLIC_ADDRESS = '93.184.216.34';

describe('fetchClientLogo', () => {
    it('re-encodes a fetched image to a fixed format and size', async () => {
        const source = await squarePng(512);
        const fetchImpl = imageResponder({ body: source, contentType: 'image/png' });

        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl,
            resolveHost: publicResolver(),
        });

        expect(logo).not.toBeNull();
        expect(logo?.contentType).toBe(LOGO_CONTENT_TYPE);

        const metadata = await sharp(logo?.data).metadata();

        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(LOGO_SIZE_PX);
        expect(metadata.height).toBe(LOGO_SIZE_PX);
    });

    it('re-encodes a jpeg to png', async () => {
        const source = await sharp({ create: square(64, '#00ff00') })
            .jpeg()
            .toBuffer();
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.jpg',
            fetchImpl: imageResponder({ body: source, contentType: 'image/jpeg' }),
            resolveHost: publicResolver(),
        });

        expect(logo?.contentType).toBe(LOGO_CONTENT_TYPE);
    });

    it('refuses a host that resolves to a private address', async () => {
        const fetchImpl = vi.fn();

        const logo = await fetchClientLogo({
            uri: 'https://internal.example.com/logo.png',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: async () => ['10.0.0.5'],
        });

        expect(logo).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses a host that resolves to a mix of public and private addresses', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://mixed.example.com/logo.png',
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: async () => [PUBLIC_ADDRESS, '127.0.0.1'],
        });

        expect(logo).toBeNull();
    });

    it.each([
        ['http', 'http://cdn.example.com/logo.png'],
        ['file', 'file:///etc/passwd'],
        ['data', 'data:image/png;base64,AAAA'],
    ])('refuses a %s URI', async (_scheme, uri) => {
        const logo = await fetchClientLogo({
            uri,
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('follows a redirect to another public host', async () => {
        const source = await squarePng(64);
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(redirectTo('https://images.example.net/logo.png'))
            .mockResolvedValueOnce(imageResponse({ body: source, contentType: 'image/png' }));

        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).not.toBeNull();
    });

    it('refuses a redirect into a private address', async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(redirectTo('https://internal.example.com/logo.png'));

        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: async (hostname) =>
                hostname === 'internal.example.com' ? ['169.254.169.254'] : [PUBLIC_ADDRESS],
        });

        expect(logo).toBeNull();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gives up on a redirect loop', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(redirectTo('https://cdn.example.com/logo.png'));

        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
        expect(fetchImpl).toHaveBeenCalledTimes(MAX_LOGO_REDIRECTS + 1);
    });

    it('refuses a response that is not an image content type', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: imageResponder({ body: Buffer.from('<html></html>'), contentType: 'text/html' }),
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('refuses a response whose declared length exceeds the cap', async () => {
        const response = imageResponse({ body: Buffer.alloc(16), contentType: 'image/png' });

        response.headers.set('content-length', String(MAX_LOGO_BYTES + 1));

        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: (() => Promise.resolve(response)) as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('refuses a body that exceeds the cap without declaring its length', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: imageResponder({ body: Buffer.alloc(MAX_LOGO_BYTES + 1), contentType: 'image/png' }),
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('refuses bytes that are not a decodable image', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: imageResponder({ body: Buffer.from('not an image'), contentType: 'image/png' }),
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('refuses a non-2xx response', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: (() => Promise.resolve(new Response('', { status: 404 }))) as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('returns null when the host cannot be reached', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch,
            resolveHost: publicResolver(),
        });

        expect(logo).toBeNull();
    });

    it('returns null when the host does not resolve', async () => {
        const logo = await fetchClientLogo({
            uri: 'https://cdn.example.com/logo.png',
            fetchImpl: vi.fn() as unknown as typeof fetch,
            resolveHost: async () => {
                throw new Error('ENOTFOUND');
            },
        });

        expect(logo).toBeNull();
    });
});

function publicResolver(): HostResolver {
    return async () => [PUBLIC_ADDRESS];
}

function square(size: number, background: string): sharp.Create {
    return { width: size, height: size, channels: 3, background };
}

async function squarePng(size: number): Promise<Buffer> {
    return sharp({ create: square(size, '#336699') })
        .png()
        .toBuffer();
}

function imageResponse({ body, contentType }: { body: Buffer; contentType: string }): Response {
    return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': contentType } });
}

function imageResponder({ body, contentType }: { body: Buffer; contentType: string }): typeof fetch {
    return (() => Promise.resolve(imageResponse({ body, contentType }))) as unknown as typeof fetch;
}

function redirectTo(location: string): Response {
    return new Response('', { status: 302, headers: { location } });
}
