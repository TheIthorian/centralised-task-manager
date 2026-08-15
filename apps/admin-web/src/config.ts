/**
 * The API is always same-origin: in production a Pages Function proxies `/api`, and in
 * development the Vite proxy does. That is not an optimisation — the Access credential is a
 * cookie on this hostname, so a cross-origin call would carry no operator identity.
 */
const config = {
    adminApiUrl: '/api',
} as const;

export default config;
