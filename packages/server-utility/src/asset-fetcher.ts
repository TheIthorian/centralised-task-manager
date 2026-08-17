import { lookup } from 'node:dns/promises';
import { isPublicUnicastAddress } from './ip-address.js';

/** An asset that was fetched within the caller's limits. */
export type FetchedAsset = {
    body: Buffer;
    contentType: string;
    /** The URI the bytes actually came from, which differs from the request after a redirect. */
    finalUri: string;
};

/** Why a fetch produced no asset. Callers decide which of these are worth reporting. */
export enum AssetRejection {
    /** The URI is not absolute, or does not use an allowed scheme. */
    UriNotAllowed = 'uri_not_allowed',
    /** The host does not resolve, or resolves to an address outside the public internet. */
    HostNotAllowed = 'host_not_allowed',
    /** The host could not be reached, or did not answer within the timeout. */
    Unreachable = 'unreachable',
    /** The host answered, but not with a 2xx. */
    NotOk = 'not_ok',
    /** More redirects than the limit allows, or a redirect with no usable target. */
    TooManyRedirects = 'too_many_redirects',
    /** The response content type is not one the caller accepts. */
    ContentTypeNotAllowed = 'content_type_not_allowed',
    /** The response is larger than the caller's byte limit. */
    TooLarge = 'too_large',
}

export type FetchAssetResult = { ok: true; asset: FetchedAsset } | { ok: false; rejection: AssetRejection };

/** Resolves a hostname to the IP addresses a connection to it would use. */
export type HostResolver = (hostname: string) => Promise<string[]>;

export type AssetFetcherOptions = {
    /** Injected so a test, or a caller with its own agent, can supply another implementation. */
    fetchImpl?: typeof fetch;
    resolveHost?: HostResolver;
    /** Defaults applied to every request; each one can be overridden per request. */
    defaults?: Partial<FetchAssetLimits>;
};

/** The bounds a single fetch runs under. */
export type FetchAssetLimits = {
    /** Content types accepted, matched against the response's media type alone. */
    allowedContentTypes: string[];
    /** Schemes the URI, and every redirect target, may use. */
    allowedSchemes: string[];
    maxBytes: number;
    maxRedirects: number;
    timeoutMs: number;
};

export type FetchAssetRequest = Partial<FetchAssetLimits> & {
    uri: string;
};

const DEFAULT_LIMITS: FetchAssetLimits = {
    allowedContentTypes: [],
    allowedSchemes: ['https:'],
    maxBytes: 1024 * 1024,
    maxRedirects: 3,
    timeoutMs: 5000,
};

/**
 * Fetches an asset from a URI supplied by someone else.
 *
 * Every host is resolved before the request and refused unless all of its addresses are on the
 * public internet, so a URI cannot be used to reach a service inside the deployment's own network,
 * and each redirect hop is checked the same way. Responses are bounded in size and media type, so
 * a hostile host cannot make the caller buffer an unbounded body.
 */
export class AssetFetcher {
    private readonly fetchImpl: typeof fetch;
    private readonly resolveHost: HostResolver;
    private readonly defaults: FetchAssetLimits;

    constructor({ fetchImpl = fetch, resolveHost = resolveHostAddresses, defaults }: AssetFetcherOptions = {}) {
        this.fetchImpl = fetchImpl;
        this.resolveHost = resolveHost;
        this.defaults = { ...DEFAULT_LIMITS, ...defaults };
    }

    /** Fetch one asset, or explain why it was refused. Never throws for a remote failure. */
    async fetchAsset(request: FetchAssetRequest): Promise<FetchAssetResult> {
        const limits: FetchAssetLimits = { ...this.defaults, ...stripUndefined(request) };
        const response = await this.fetchFollowingRedirects({ uri: request.uri, limits });

        if (!response.ok) return response;

        const contentType = mediaType(response.response.headers.get('content-type'));

        if (limits.allowedContentTypes.length > 0 && !limits.allowedContentTypes.includes(contentType)) {
            return { ok: false, rejection: AssetRejection.ContentTypeNotAllowed };
        }

        const declaredLength = Number(response.response.headers.get('content-length') ?? Number.NaN);

        if (Number.isFinite(declaredLength) && declaredLength > limits.maxBytes) {
            return { ok: false, rejection: AssetRejection.TooLarge };
        }

        const body = await readCappedBody({ response: response.response, maxBytes: limits.maxBytes });

        if (!body.ok) return body;

        return { ok: true, asset: { body: body.body, contentType, finalUri: response.uri } };
    }

    private async fetchFollowingRedirects({
        uri,
        limits,
    }: {
        uri: string;
        limits: FetchAssetLimits;
    }): Promise<{ ok: true; response: Response; uri: string } | { ok: false; rejection: AssetRejection }> {
        let current = uri;

        for (let hop = 0; hop <= limits.maxRedirects; hop++) {
            const rejection = await this.checkUri({ uri: current, limits });

            if (rejection) return { ok: false, rejection };

            let response: Response;

            try {
                response = await this.fetchImpl(current, {
                    method: 'GET',
                    redirect: 'manual',
                    signal: AbortSignal.timeout(limits.timeoutMs),
                    headers: limits.allowedContentTypes.length > 0
                        ? { accept: limits.allowedContentTypes.join(', ') }
                        : {},
                });
            } catch {
                return { ok: false, rejection: AssetRejection.Unreachable };
            }

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');

                if (!location) return { ok: false, rejection: AssetRejection.TooManyRedirects };

                try {
                    current = new URL(location, current).toString();
                } catch {
                    return { ok: false, rejection: AssetRejection.UriNotAllowed };
                }

                continue;
            }

            if (!response.ok) return { ok: false, rejection: AssetRejection.NotOk };

            return { ok: true, response, uri: current };
        }

        return { ok: false, rejection: AssetRejection.TooManyRedirects };
    }

    /** Returns the reason this exact URI may not be fetched, or null if it may. */
    private async checkUri({
        uri,
        limits,
    }: {
        uri: string;
        limits: FetchAssetLimits;
    }): Promise<AssetRejection | null> {
        let url: URL;

        try {
            url = new URL(uri);
        } catch {
            return AssetRejection.UriNotAllowed;
        }

        if (!limits.allowedSchemes.includes(url.protocol)) return AssetRejection.UriNotAllowed;

        // URL keeps the brackets around an IPv6 literal, which the address parser does not accept.
        const hostname = url.hostname.replace(/^\[|\]$/g, '');

        let addresses: string[];

        try {
            addresses = await this.resolveHost(hostname);
        } catch {
            return AssetRejection.HostNotAllowed;
        }

        if (addresses.length === 0) return AssetRejection.HostNotAllowed;

        return addresses.every(isPublicUnicastAddress) ? null : AssetRejection.HostNotAllowed;
    }
}

function stripUndefined(request: FetchAssetRequest): Partial<FetchAssetLimits> {
    const entries = Object.entries(request).filter(([key, value]) => key !== 'uri' && value !== undefined);

    return Object.fromEntries(entries) as Partial<FetchAssetLimits>;
}

function mediaType(header: string | null): string {
    return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/** Reads the body, giving up as soon as it exceeds the cap rather than buffering all of it. */
async function readCappedBody({
    response,
    maxBytes,
}: {
    response: Response;
    maxBytes: number;
}): Promise<{ ok: true; body: Buffer } | { ok: false; rejection: AssetRejection }> {
    if (!response.body) return { ok: true, body: Buffer.alloc(0) };

    const chunks: Buffer[] = [];
    let total = 0;

    try {
        for await (const chunk of response.body) {
            const buffer = Buffer.from(chunk);

            total += buffer.byteLength;

            if (total > maxBytes) return { ok: false, rejection: AssetRejection.TooLarge };

            chunks.push(buffer);
        }
    } catch {
        return { ok: false, rejection: AssetRejection.Unreachable };
    }

    return { ok: true, body: Buffer.concat(chunks) };
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
    const results = await lookup(hostname, { all: true, verbatim: true });

    return results.map((result) => result.address);
}
