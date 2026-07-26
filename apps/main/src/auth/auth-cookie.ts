import type { CookieSerializeOptions } from '@fastify/cookie';

/** Name of the HttpOnly refresh cookie issued to the web client. */
export const REFRESH_COOKIE_NAME = 'ctm_refresh';

/** Request header the same-origin proxy stamps on web traffic. */
export const WEB_CLIENT_HEADER = 'x-ctm-client';

/** Value of {@link WEB_CLIENT_HEADER} that identifies the browser app. */
export const WEB_CLIENT_VALUE = 'web';

/**
 * Whether the request arrived through the web proxy and should get a cookie
 * instead of a refresh token in the response body.
 */
export function isWebClient({
    headers,
}: {
    headers: Record<string, string | string[] | undefined>;
}): boolean {
    return headers[WEB_CLIENT_HEADER] === WEB_CLIENT_VALUE;
}

/** Cookie attributes for the refresh token. */
export function buildRefreshCookieOptions({
    path,
    secure,
    maxAgeDays,
}: {
    path: string;
    secure: boolean;
    maxAgeDays: number;
}): CookieSerializeOptions {
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path,
        maxAge: maxAgeDays * 24 * 60 * 60,
    };
}
