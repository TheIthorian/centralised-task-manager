import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STRICT_RATE_LIMIT_KEY } from './rate-limit.constants.js';

// Reflector has no dependencies, so a module-level instance keeps this usable from the
// throttler option factory, which receives a context but cannot inject providers.
const reflector = new Reflector();

/** Whether the handled route is marked with `@StrictRateLimit()`. */
export function isStrictRateLimited(context: ExecutionContext): boolean {
    return (
        reflector.getAllAndOverride<boolean>(STRICT_RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]) === true
    );
}
