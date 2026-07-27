import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import { STRICT_RATE_LIMIT_KEY } from './rate-limit.constants.js';

/**
 * Marks a route as part of the unauthenticated abuse surface (login, register, token
 * exchange). Such routes get the tighter strict limits and their own per-route bucket,
 * so brute force cannot be hidden inside a user's normal request budget.
 */
export function StrictRateLimit(): CustomDecorator<string> {
    return SetMetadata(STRICT_RATE_LIMIT_KEY, true);
}
