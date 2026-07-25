import { buildProxyRequest } from './proxy.js';

type Env = {
    API_ORIGIN: string;
};

/**
 * Same-origin proxy for the CTM API. Everything under /api is forwarded to
 * API_ORIGIN so the browser and the API share an origin, which is what makes
 * the HttpOnly refresh cookie possible.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    if (!env.API_ORIGIN) {
        return new Response('API_ORIGIN is not configured for this Pages project', { status: 500 });
    }

    return fetch(buildProxyRequest({ request, apiOrigin: env.API_ORIGIN }));
};
