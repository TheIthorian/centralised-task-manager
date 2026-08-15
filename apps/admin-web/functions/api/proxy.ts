/** Set by Cloudflare Access on every request it lets through. The operator's identity. */
const ACCESS_ASSERTION_HEADER = 'Cf-Access-Jwt-Assertion';

/**
 * Rewrite a browser request for `/api/*` into a request against the operator API origin.
 *
 * Access sits in front of this Pages project, so it has already stamped the request with a
 * signed assertion by the time this runs. Forwarding it unchanged is what authenticates the
 * proxied call: the API verifies the signature itself, so a request that arrives without one,
 * or with a forged one, is rejected there.
 */
export function buildProxyRequest({ request, adminApiOrigin }: { request: Request; adminApiOrigin: string }): Request {
    const url = new URL(request.url);
    // Anchored so `/apiary` is not mistaken for the `/api` prefix.
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const target = new URL(`${path}${url.search}`, adminApiOrigin);

    // Cloning the original request preserves streamed bodies; a hand-built init loses them
    // and needs `duplex: 'half'`.
    return new Request(target, request);
}

/** Whether Access authenticated this request. Absent means the Pages project is unprotected. */
export function hasAccessAssertion(request: Request): boolean {
    return (request.headers.get(ACCESS_ASSERTION_HEADER) ?? '').length > 0;
}
