/** Header Cloudflare Access stamps on every request it lets through. */
export const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

/** Cookie Access sets alongside the header, used when a browser navigates directly. */
export const ACCESS_JWT_COOKIE = 'CF_Authorization';

/** The operator behind a request, as Cloudflare Access identified them. */
export type AccessIdentity = {
    /** Verified email from the Access token. The audit log records this as the actor. */
    email: string;
    /** Access's own subject identifier for the user. */
    subject: string;
};
