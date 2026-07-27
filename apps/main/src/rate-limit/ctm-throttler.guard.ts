import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    InjectThrottlerOptions,
    InjectThrottlerStorage,
    ThrottlerGuard,
    type ThrottlerLimitDetail,
    type ThrottlerModuleOptions,
    type ThrottlerStorage,
} from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { RateLimitError } from '@ctm/errors';
import { CLIENT_TRACKER_MARKER } from './principal-resolver.js';
import { resolveRateLimitProfile } from './resolve-rate-limit-profile.js';

@Injectable()
export class CtmThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
    ) {
        super(options, storageService, reflector);
    }

    /**
     * Routes with their own profile get a per-route bucket; everything else shares one
     * account-wide bucket, so the quota is a real budget rather than a per-endpoint allowance.
     */
    protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
        const scope =
            resolveRateLimitProfile(context) === 'general'
                ? 'global'
                : `${context.getClass().name}.${context.getHandler().name}`;

        return createHash('sha256').update(`${name}-${scope}-${suffix}`).digest('hex');
    }

    protected override async throwThrottlingException(
        _context: ExecutionContext,
        detail: ThrottlerLimitDetail,
    ): Promise<void> {
        const retryAfterSeconds = Math.max(1, detail.isBlocked ? detail.timeToBlockExpire : detail.timeToExpire);

        throw new RateLimitError({
            message: detail.tracker.includes(CLIENT_TRACKER_MARKER)
                ? 'This client is sending too many requests. Slow down and retry later.'
                : 'Rate limit exceeded. Slow down and retry later.',
            retryAfterSeconds,
        });
    }
}
