const WEB_CLIENT_HEADER = 'X-Ctm-Client';
const WEB_CLIENT_VALUE = 'web';

/**
 * Rewrite a browser request for `/api/*` into a request against the API origin.
 * Strips the `/api` prefix and replaces any client-supplied `X-Ctm-Client`, so
 * only traffic that genuinely came through this proxy is treated as the web app.
 *
 * Built as `new Request(target, request)` — passing the original `Request` as the
 * second argument, rather than rebuilding an `init` object field-by-field — per
 * Cloudflare's guidance for proxying through a Worker/Pages Function. This carries
 * over the original body stream, method, and (crucially) WebSocket upgrade headers
 * automatically, so a `Upgrade: websocket` request keeps upgrading. Rebuilding the
 * init manually needed an explicit `duplex: 'half'` for streamed bodies; letting the
 * runtime copy the request directly removes that need entirely.
 */
export function buildProxyRequest({ request, apiOrigin }: { request: Request; apiOrigin: string }): Request {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const target = new URL(`${path}${url.search}`, apiOrigin);

    const proxied = new Request(target, request);

    // `Headers#set` replaces any existing value for the name outright, so a
    // client-supplied `X-Ctm-Client` is overwritten, not merely appended to.
    proxied.headers.set(WEB_CLIENT_HEADER, WEB_CLIENT_VALUE);

    return proxied;
}
