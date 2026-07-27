import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_PROFILE_KEY, type RateLimitProfile } from './rate-limit.constants.js';

/**
 * Marks a route as part of the unauthenticated abuse surface (login, register, token
 * exchange). Such routes get the tighter strict limits and their own per-route bucket,
 * so brute force cannot be hidden inside a user's normal request budget.
 */
export function StrictRateLimit(): CustomDecorator<string> {
    return SetMetadata<string, RateLimitProfile>(RATE_LIMIT_PROFILE_KEY, 'strict');
}

/**
 * Marks the token refresh route, which is paced by expiring access tokens rather than by
 * the user. It gets its own generous bucket so refreshes neither consume a user's request
 * budget nor compete with sign-in attempts from the same address.
 */
export function RefreshRateLimit(): CustomDecorator<string> {
    return SetMetadata<string, RateLimitProfile>(RATE_LIMIT_PROFILE_KEY, 'refresh');
}
