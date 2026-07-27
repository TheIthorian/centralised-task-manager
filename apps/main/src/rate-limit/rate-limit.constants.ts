/**
 * Name of the per-minute throttler. It is called `default` so its headers are emitted
 * unsuffixed (`X-RateLimit-Limit`) — @nestjs/throttler only omits the suffix for this name.
 */
export const BURST_THROTTLER = 'default';

/** Name of the per-hour throttler. Emits `X-RateLimit-*-sustained` headers. */
export const SUSTAINED_THROTTLER = 'sustained';

export const BURST_WINDOW_MS = 60_000;
export const SUSTAINED_WINDOW_MS = 60 * 60_000;

/**
 * Which budget a route draws on. `general` is the shared account-wide budget; the others
 * each get their own per-route bucket so they cannot starve normal use, or be starved by it.
 */
export type RateLimitProfile = 'general' | 'strict' | 'refresh';

/** Metadata key holding a route's {@link RateLimitProfile}. */
export const RATE_LIMIT_PROFILE_KEY = 'ctm:rate-limit-profile';
