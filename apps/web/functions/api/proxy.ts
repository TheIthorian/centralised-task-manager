const WEB_CLIENT_HEADER = 'X-Ctm-Client';
const WEB_CLIENT_VALUE = 'web';

/**
 * Rewrite a browser request for `/api/*` into a request against the API origin.
 * Strips the `/api` prefix and replaces any client-supplied `X-Ctm-Client`, so
 * only traffic that genuinely came through this proxy is treated as the web app.
 */
export function buildProxyRequest({ request, apiOrigin }: { request: Request; apiOrigin: string }): Request {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const target = new URL(`${path}${url.search}`, apiOrigin);

    const headers = new Headers(request.headers);

    headers.delete(WEB_CLIENT_HEADER);
    headers.set(WEB_CLIENT_HEADER, WEB_CLIENT_VALUE);

    const init: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
    };

    // The Fetch spec requires `duplex: 'half'` whenever the body is a stream;
    // omitting it throws in Node/undici (and the underlying runtime here).
    if (request.body) {
        init.duplex = 'half';
    }

    return new Request(target, init);
}
