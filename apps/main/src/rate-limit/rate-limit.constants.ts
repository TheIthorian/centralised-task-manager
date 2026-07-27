/**
 * Name of the per-minute throttler. It is called `default` so its headers are emitted
 * unsuffixed (`X-RateLimit-Limit`) — @nestjs/throttler only omits the suffix for this name.
 */
export const BURST_THROTTLER = 'default';

/** Name of the per-hour throttler. Emits `X-RateLimit-*-sustained` headers. */
export const SUSTAINED_THROTTLER = 'sustained';

export const BURST_WINDOW_MS = 60_000;
export const SUSTAINED_WINDOW_MS = 60 * 60_000;

/** Metadata key marking a route as part of the unauthenticated abuse surface. */
export const STRICT_RATE_LIMIT_KEY = 'ctm:strict-rate-limit';
