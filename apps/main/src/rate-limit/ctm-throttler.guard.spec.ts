import { Controller, type ExecutionContext, Get } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppErrorFilter } from '../common/filters/app-error.filter.js';
import { CtmThrottlerGuard } from './ctm-throttler.guard.js';
import { isStrictRateLimited } from './is-strict-rate-limited.js';
import { BURST_THROTTLER, BURST_WINDOW_MS, SUSTAINED_THROTTLER, SUSTAINED_WINDOW_MS } from './rate-limit.constants.js';
import { StrictRateLimit } from './strict-rate-limit.decorator.js';

const OPEN_LIMIT = 3;
const STRICT_LIMIT = 1;

@Controller('probe')
class ProbeController {
    @Get('open')
    open(): string {
        return 'ok';
    }

    @Get('other')
    other(): string {
        return 'ok';
    }

    @Get('strict')
    @StrictRateLimit()
    strict(): string {
        return 'ok';
    }
}

/** Treats any `user-*` bearer as a valid token for that principal; anything else is forged. */
const jwtStub = {
    verify: (token: string): { sub: string } => {
        if (!token.startsWith('user-')) throw new Error('invalid token');

        return { sub: token };
    },
};

describe('CtmThrottlerGuard', () => {
    let app: NestFastifyApplication;

    const call = ({ path, token, ip }: { path: string; token?: string; ip: string }) =>
        app.inject({
            method: 'GET',
            url: path,
            remoteAddress: ip,
            ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
        });

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot({
                    throttlers: [
                        {
                            name: BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                isStrictRateLimited(context) ? STRICT_LIMIT : OPEN_LIMIT,
                        },
                        { name: SUSTAINED_THROTTLER, ttl: SUSTAINED_WINDOW_MS, limit: 1000 },
                    ],
                }),
            ],
            controllers: [ProbeController],
            providers: [
                { provide: JwtService, useValue: jwtStub },
                { provide: APP_GUARD, useClass: CtmThrottlerGuard },
                { provide: APP_FILTER, useClass: AppErrorFilter },
            ],
        }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('allows requests up to the burst limit and reports the remaining budget', async () => {
        const first = await call({ path: '/probe/open', ip: '10.0.0.1' });

        expect(first.statusCode).toBe(200);
        expect(first.headers['x-ratelimit-limit']).toBe(String(OPEN_LIMIT));
        expect(first.headers['x-ratelimit-remaining']).toBe(String(OPEN_LIMIT - 1));
    });

    it('rejects with 429 and a Retry-After once the burst limit is exceeded', async () => {
        const ip = '10.0.0.2';

        for (let i = 0; i < OPEN_LIMIT; i++) {
            expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
        }

        const blocked = await call({ path: '/probe/open', ip });

        expect(blocked.statusCode).toBe(429);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
        expect(blocked.json()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 });
    });

    it('shares one budget across routes for the same caller', async () => {
        const ip = '10.0.0.3';

        for (let i = 0; i < OPEN_LIMIT; i++) {
            expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/other', ip })).statusCode).toBe(429);
    });

    it('keys on the authenticated user, so one account cannot spend another budget', async () => {
        const ip = '10.0.0.4';

        for (let i = 0; i < OPEN_LIMIT; i++) {
            expect((await call({ path: '/probe/open', token: 'user-a', ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', token: 'user-a', ip })).statusCode).toBe(429);
        expect((await call({ path: '/probe/open', token: 'user-b', ip })).statusCode).toBe(200);
    });

    it('follows the user across IP addresses', async () => {
        for (let i = 0; i < OPEN_LIMIT; i++) {
            expect((await call({ path: '/probe/open', token: 'user-c', ip: `10.1.0.${i}` })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', token: 'user-c', ip: '10.1.0.9' })).statusCode).toBe(429);
    });

    it('ignores an unverifiable bearer token and falls back to the IP', async () => {
        const ip = '10.0.0.5';

        for (let i = 0; i < OPEN_LIMIT; i++) {
            expect((await call({ path: '/probe/open', token: `forged-${i}`, ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', token: 'forged-final', ip })).statusCode).toBe(429);
    });

    it('gives strict routes their own tighter bucket', async () => {
        const ip = '10.0.0.6';

        expect((await call({ path: '/probe/strict', ip })).statusCode).toBe(200);
        expect((await call({ path: '/probe/strict', ip })).statusCode).toBe(429);

        // The strict route's own limit must not eat into the general budget.
        expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
    });
});
