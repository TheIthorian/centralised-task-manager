import { type ExecutionContext, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CtmThrottlerGuard } from './ctm-throttler.guard.js';
import { PrincipalResolver } from './principal-resolver.js';
import { resolveRateLimitProfile } from './resolve-rate-limit-profile.js';
import {
    BURST_THROTTLER,
    BURST_WINDOW_MS,
    CLIENT_BURST_THROTTLER,
    CLIENT_SUSTAINED_THROTTLER,
    type RateLimitProfile,
    SUSTAINED_THROTTLER,
    SUSTAINED_WINDOW_MS,
} from './rate-limit.constants.js';

/**
 * Fair-usage rate limiting for the whole HTTP surface, in two layers.
 *
 * The account limits are the ceiling: they key on the user id — an identity a caller cannot
 * multiply for free — and on the client IP for anonymous traffic. Under them sit per-client
 * fences keyed on (user, client_id), which are not a quota grant but a guarantee that one
 * of a user's clients cannot spend the whole account budget and 429 the others.
 *
 * Storage is in-process, which is exact only while the API runs on a single replica — a
 * shared store is needed before scaling out.
 */
@Module({
    imports: [
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const principals = new PrincipalResolver({
                    publicKey: Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8'),
                });

                const burstByProfile: Record<RateLimitProfile, number> = {
                    general: config.getOrThrow<number>('RATE_LIMIT_BURST_PER_MINUTE'),
                    strict: config.getOrThrow<number>('RATE_LIMIT_STRICT_BURST_PER_MINUTE'),
                    refresh: config.getOrThrow<number>('RATE_LIMIT_REFRESH_BURST_PER_MINUTE'),
                };
                const sustainedByProfile: Record<RateLimitProfile, number> = {
                    general: config.getOrThrow<number>('RATE_LIMIT_SUSTAINED_PER_HOUR'),
                    strict: config.getOrThrow<number>('RATE_LIMIT_STRICT_SUSTAINED_PER_HOUR'),
                    refresh: config.getOrThrow<number>('RATE_LIMIT_REFRESH_SUSTAINED_PER_HOUR'),
                };

                // Anonymous callers have no client dimension, and their ceiling is already
                // keyed on the IP — running the fence too would just impose a lower ceiling.
                const isAnonymous = (context: ExecutionContext): boolean =>
                    principals.resolve(context.switchToHttp().getRequest<Record<string, unknown>>()) === null;

                return {
                    throttlers: [
                        {
                            name: BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                burstByProfile[resolveRateLimitProfile(context)],
                            getTracker: (req: Record<string, unknown>): string => principals.accountKey(req),
                        },
                        {
                            name: SUSTAINED_THROTTLER,
                            ttl: SUSTAINED_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                sustainedByProfile[resolveRateLimitProfile(context)],
                            getTracker: (req: Record<string, unknown>): string => principals.accountKey(req),
                        },
                        {
                            name: CLIENT_BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: config.getOrThrow<number>('RATE_LIMIT_CLIENT_BURST_PER_MINUTE'),
                            getTracker: (req: Record<string, unknown>): string => principals.clientKey(req),
                            skipIf: isAnonymous,
                        },
                        {
                            name: CLIENT_SUSTAINED_THROTTLER,
                            ttl: SUSTAINED_WINDOW_MS,
                            limit: config.getOrThrow<number>('RATE_LIMIT_CLIENT_SUSTAINED_PER_HOUR'),
                            getTracker: (req: Record<string, unknown>): string => principals.clientKey(req),
                            skipIf: isAnonymous,
                        },
                    ],
                };
            },
        }),
    ],
    providers: [{ provide: APP_GUARD, useClass: CtmThrottlerGuard }],
})
export class RateLimitModule {}
