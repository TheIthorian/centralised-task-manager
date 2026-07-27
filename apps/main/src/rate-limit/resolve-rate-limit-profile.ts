import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_PROFILE_KEY, type RateLimitProfile } from './rate-limit.constants.js';

// Reflector has no dependencies, so a module-level instance keeps this usable from the
// throttler option factory, which receives a context but cannot inject providers.
const reflector = new Reflector();

/** The rate-limit profile of the handled route, defaulting to the shared account budget. */
export function resolveRateLimitProfile(context: ExecutionContext): RateLimitProfile {
    return (
        reflector.getAllAndOverride<RateLimitProfile>(RATE_LIMIT_PROFILE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? 'general'
    );
}
