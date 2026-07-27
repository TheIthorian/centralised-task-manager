import { type ExecutionContext, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { CtmThrottlerGuard } from './ctm-throttler.guard.js';
import { resolveRateLimitProfile } from './resolve-rate-limit-profile.js';
import {
    BURST_THROTTLER,
    BURST_WINDOW_MS,
    type RateLimitProfile,
    SUSTAINED_THROTTLER,
    SUSTAINED_WINDOW_MS,
} from './rate-limit.constants.js';

/**
 * Fair-usage rate limiting for the whole HTTP surface: a burst limit per minute and a
 * sustained limit per hour, keyed on the user when authenticated and on the client IP
 * otherwise. Storage is in-process, which is exact only while the API runs on a single
 * replica — a shared store is needed before scaling out.
 */
@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                publicKey: Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8'),
            }),
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
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

                return {
                    throttlers: [
                        {
                            name: BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                burstByProfile[resolveRateLimitProfile(context)],
                        },
                        {
                            name: SUSTAINED_THROTTLER,
                            ttl: SUSTAINED_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                sustainedByProfile[resolveRateLimitProfile(context)],
                        },
                    ],
                };
            },
        }),
    ],
    providers: [{ provide: APP_GUARD, useClass: CtmThrottlerGuard }],
})
export class RateLimitModule {}
