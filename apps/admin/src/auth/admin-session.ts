/** Name of the httpOnly cookie carrying the admin session. */
export const ADMIN_SESSION_COOKIE = 'ctm_admin_session';

/**
 * Audience stamped on an admin session token.
 *
 * `apps/main` signs with a different secret and never accepts this audience, so an admin session
 * is not a bearer token for the task API.
 */
export const ADMIN_TOKEN_AUDIENCE = 'ctm-admin';

/** Claims carried by an admin session token. */
export type AdminSessionClaims = {
    sub: string;
    aud: string;
};
