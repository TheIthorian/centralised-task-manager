import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
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
import { resolveRateLimitProfile } from './resolve-rate-limit-profile.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class CtmThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        private readonly jwt: JwtService,
    ) {
        super(options, storageService, reflector);
    }

    /**
     * Key on the authenticated user where possible so a quota survives NAT, mobile
     * networks and token rotation, falling back to the client IP for anonymous traffic.
     */
    protected override async getTracker(req: Record<string, unknown>): Promise<string> {
        const userId = this.resolveUserId(req);

        if (userId) return `user:${userId}`;

        const ip = req['ip'];

        return `ip:${typeof ip === 'string' ? ip : 'unknown'}`;
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
            message: 'Rate limit exceeded. Slow down and retry later.',
            retryAfterSeconds,
        });
    }

    /**
     * The global guard runs before the route's auth guard, so the principal is not on the
     * request yet — verify the bearer token here instead. An unverified token would let a
     * caller mint a fresh identity per request and skip the quota entirely.
     */
    private resolveUserId(req: Record<string, unknown>): string | null {
        const headers = req['headers'];

        if (typeof headers !== 'object' || headers === null) return null;

        const authorization = (headers as Record<string, unknown>)['authorization'];

        if (typeof authorization !== 'string' || !authorization.startsWith(BEARER_PREFIX)) return null;

        try {
            const payload = this.jwt.verify<Record<string, unknown>>(authorization.slice(BEARER_PREFIX.length), {
                algorithms: ['RS256'],
            });

            return typeof payload['sub'] === 'string' ? payload['sub'] : null;
        } catch {
            return null;
        }
    }
}
