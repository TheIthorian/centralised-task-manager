import { buildProxyRequest, hasAccessAssertion } from './proxy.js';

type Env = {
    ADMIN_API_ORIGIN: string;
};

/**
 * Same-origin proxy for the operator API.
 *
 * The browser cannot call the API directly: the Access cookie belongs to this hostname, so a
 * cross-origin call would carry no operator identity at all. Routing through here means every
 * request passes Access first and arrives at the API already signed.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    if (!env.ADMIN_API_ORIGIN) {
        return new Response('ADMIN_API_ORIGIN is not configured for this Pages project', { status: 500 });
    }

    // Failing closed here turns "the Access application was deleted" into a visible error
    // rather than a console full of 401s from the API.
    if (!hasAccessAssertion(request)) {
        return new Response('This deployment is not behind Cloudflare Access', { status: 403 });
    }

    return fetch(buildProxyRequest({ request, adminApiOrigin: env.ADMIN_API_ORIGIN }));
};
