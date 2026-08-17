import { lookup } from 'node:dns/promises';
import sharp from 'sharp';
import { isPublicUnicastAddress } from './ip-address.js';

/** Formats accepted from a client. Anything else is refused rather than handed to the encoder. */
const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

/** Format every stored logo is re-encoded to, whatever arrived. */
export const LOGO_CONTENT_TYPE = 'image/png';

/** Edge length of the stored square logo, in pixels. */
export const LOGO_SIZE_PX = 128;

/** Largest response accepted from the client's host, before decoding. */
export const MAX_LOGO_BYTES = 512 * 1024;

/** Largest decoded image accepted, so a small file cannot expand into a huge bitmap. */
export const MAX_LOGO_DIMENSION_PX = 4096;

export const MAX_LOGO_REDIRECTS = 3;

const FETCH_TIMEOUT_MS = 5000;

/** A logo that has been fetched, validated and re-encoded, ready to store. */
export type FetchedLogo = {
    data: Buffer;
    contentType: string;
};

/** Resolves a hostname to the IP addresses a connection to it would use. */
export type HostResolver = (hostname: string) => Promise<string[]>;

export type FetchClientLogoOptions = {
    uri: string;
    fetchImpl?: typeof fetch;
    resolveHost?: HostResolver;
};

/**
 * Fetch a client's declared logo and re-encode it to a fixed format and size.
 *
 * Returns null when the URI is not fetchable under the safety rules, the response is not a usable
 * image, or the host does not answer: a client that declares a bad logo still registers.
 */
export async function fetchClientLogo({
    uri,
    fetchImpl = fetch,
    resolveHost = resolveHostAddresses,
}: FetchClientLogoOptions): Promise<FetchedLogo | null> {
    const response = await fetchFollowingRedirects({ uri, fetchImpl, resolveHost });

    if (!response) return null;

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return null;

    const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN);

    if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGO_BYTES) return null;

    const body = await readCappedBody(response);

    if (!body) return null;

    return encodeLogo(body);
}

/**
 * Re-encode arbitrary image bytes into the stored logo format.
 * Returns null if the bytes are not an image, or decode to more pixels than are allowed.
 */
export async function encodeLogo(body: Buffer): Promise<FetchedLogo | null> {
    try {
        const image = sharp(body, { animated: false });
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) return null;

        if (metadata.width > MAX_LOGO_DIMENSION_PX || metadata.height > MAX_LOGO_DIMENSION_PX) return null;

        const data = await image
            .resize({
                width: LOGO_SIZE_PX,
                height: LOGO_SIZE_PX,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();

        return { data, contentType: LOGO_CONTENT_TYPE };
    } catch {
        return null;
    }
}

async function fetchFollowingRedirects({
    uri,
    fetchImpl,
    resolveHost,
}: {
    uri: string;
    fetchImpl: typeof fetch;
    resolveHost: HostResolver;
}): Promise<Response | null> {
    let current = uri;

    for (let hop = 0; hop <= MAX_LOGO_REDIRECTS; hop++) {
        if (!(await isFetchableUri({ uri: current, resolveHost }))) return null;

        let response: Response;

        try {
            response = await fetchImpl(current, {
                method: 'GET',
                redirect: 'manual',
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: { accept: [...ALLOWED_CONTENT_TYPES].join(', ') },
            });
        } catch {
            return null;
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');

            if (!location) return null;

            try {
                current = new URL(location, current).toString();
            } catch {
                return null;
            }

            continue;
        }

        if (!response.ok) return null;

        return response;
    }

    return null;
}

/**
 * Returns true if this exact URI may be fetched: https only, and every address its host resolves
 * to is publicly routable. Each redirect hop is checked again, since only the first URI was
 * validated at registration.
 */
async function isFetchableUri({ uri, resolveHost }: { uri: string; resolveHost: HostResolver }): Promise<boolean> {
    let url: URL;

    try {
        url = new URL(uri);
    } catch {
        return false;
    }

    if (url.protocol !== 'https:') return false;

    const hostname = url.hostname.replace(/^\[|\]$/g, '');

    let addresses: string[];

    try {
        addresses = await resolveHost(hostname);
    } catch {
        return false;
    }

    if (addresses.length === 0) return false;

    return addresses.every(isPublicUnicastAddress);
}

/** Reads the body, giving up as soon as it exceeds the cap rather than buffering all of it. */
async function readCappedBody(response: Response): Promise<Buffer | null> {
    if (!response.body) return null;

    const chunks: Buffer[] = [];
    let total = 0;

    try {
        for await (const chunk of response.body) {
            const buffer = Buffer.from(chunk);

            total += buffer.byteLength;

            if (total > MAX_LOGO_BYTES) return null;

            chunks.push(buffer);
        }
    } catch {
        return null;
    }

    return Buffer.concat(chunks);
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
    const results = await lookup(hostname, { all: true, verbatim: true });

    return results.map((result) => result.address);
}
