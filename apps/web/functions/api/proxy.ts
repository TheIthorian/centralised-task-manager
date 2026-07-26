const WEB_CLIENT_HEADER = 'X-Ctm-Client';
const WEB_CLIENT_VALUE = 'web';

/**
 * Rewrite a browser request for `/api/*` into a request against the API origin.
 *
 * Only traffic through this proxy may claim to be the web app, so the stamped
 * `X-Ctm-Client` must overwrite whatever the client sent.
 */
export function buildProxyRequest({ request, apiOrigin }: { request: Request; apiOrigin: string }): Request {
    const url = new URL(request.url);
    // Anchored so `/apiary` is not mistaken for the `/api` prefix.
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const target = new URL(`${path}${url.search}`, apiOrigin);

    // Cloning the original request preserves WebSocket upgrades and streamed bodies;
    // a hand-built init loses the upgrade and needs `duplex: 'half'`.
    const proxied = new Request(target, request);

    proxied.headers.set(WEB_CLIENT_HEADER, WEB_CLIENT_VALUE);

    return proxied;
}
