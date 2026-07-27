import { Controller, type ExecutionContext, Get } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppErrorFilter } from '../common/filters/app-error.filter.js';
import { CtmThrottlerGuard } from './ctm-throttler.guard.js';
import { PrincipalResolver, UNREGISTERED_CLIENT } from './principal-resolver.js';
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
import { RefreshRateLimit, StrictRateLimit } from './rate-limit.decorators.js';

const ACCOUNT_LIMIT = 6;
const CLIENT_LIMIT = 3;
const STRICT_LIMIT = 1;
const REFRESH_LIMIT = 5;

const LIMIT_BY_PROFILE: Record<RateLimitProfile, number> = {
    general: ACCOUNT_LIMIT,
    strict: STRICT_LIMIT,
    refresh: REFRESH_LIMIT,
};

const pem = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');

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

    @Get('refresh')
    @RefreshRateLimit()
    refresh(): string {
        return 'ok';
    }
}

describe('CtmThrottlerGuard', () => {
    let app: NestFastifyApplication;
    let signer: JwtService;

    const token = ({ sub, clientId }: { sub: string; clientId?: string }): string =>
        signer.sign(clientId === undefined ? { sub } : { sub, client_id: clientId });

    const call = ({ path, token: bearer, ip }: { path: string; token?: string; ip: string }) =>
        app.inject({
            method: 'GET',
            url: path,
            remoteAddress: ip,
            ...(bearer ? { headers: { authorization: `Bearer ${bearer}` } } : {}),
        });

    beforeAll(async () => {
        const publicKey = pem(process.env['RSA_PUBLIC_KEY']!);

        signer = new JwtService({
            privateKey: pem(process.env['RSA_PRIVATE_KEY']!),
            publicKey,
            signOptions: { algorithm: 'RS256', expiresIn: 300 },
        });

        const principals = new PrincipalResolver({ publicKey });
        const isAnonymous = (context: ExecutionContext): boolean =>
            principals.resolve(context.switchToHttp().getRequest<Record<string, unknown>>()) === null;

        const moduleRef = await Test.createTestingModule({
            imports: [
                ThrottlerModule.forRoot({
                    throttlers: [
                        {
                            name: BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: (context: ExecutionContext): number =>
                                LIMIT_BY_PROFILE[resolveRateLimitProfile(context)],
                            getTracker: (req: Record<string, unknown>): string => principals.accountKey(req),
                        },
                        {
                            name: SUSTAINED_THROTTLER,
                            ttl: SUSTAINED_WINDOW_MS,
                            limit: 1000,
                            getTracker: (req: Record<string, unknown>): string => principals.accountKey(req),
                        },
                        {
                            name: CLIENT_BURST_THROTTLER,
                            ttl: BURST_WINDOW_MS,
                            limit: CLIENT_LIMIT,
                            getTracker: (req: Record<string, unknown>): string => principals.clientKey(req),
                            skipIf: isAnonymous,
                        },
                        {
                            name: CLIENT_SUSTAINED_THROTTLER,
                            ttl: SUSTAINED_WINDOW_MS,
                            limit: 1000,
                            getTracker: (req: Record<string, unknown>): string => principals.clientKey(req),
                            skipIf: isAnonymous,
                        },
                    ],
                }),
            ],
            controllers: [ProbeController],
            providers: [
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
        expect(first.headers['x-ratelimit-limit']).toBe(String(ACCOUNT_LIMIT));
        expect(first.headers['x-ratelimit-remaining']).toBe(String(ACCOUNT_LIMIT - 1));
    });

    it('rejects with 429 and a Retry-After once the burst limit is exceeded', async () => {
        const ip = '10.0.0.2';

        for (let i = 0; i < ACCOUNT_LIMIT; i++) {
            expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
        }

        const blocked = await call({ path: '/probe/open', ip });

        expect(blocked.statusCode).toBe(429);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
        expect(blocked.json()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 });
    });

    it('shares one budget across routes for the same caller', async () => {
        const ip = '10.0.0.3';

        for (let i = 0; i < ACCOUNT_LIMIT; i++) {
            expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/other', ip })).statusCode).toBe(429);
    });

    it('keys the ceiling on the user, so one account cannot spend another budget', async () => {
        const ip = '10.0.0.4';
        const a = token({ sub: 'user-a' });
        const b = token({ sub: 'user-b' });

        for (let i = 0; i < CLIENT_LIMIT; i++) {
            expect((await call({ path: '/probe/open', token: a, ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', token: a, ip })).statusCode).toBe(429);
        expect((await call({ path: '/probe/open', token: b, ip })).statusCode).toBe(200);
    });

    it('follows the user across IP addresses', async () => {
        const bearer = token({ sub: 'user-c' });

        for (let i = 0; i < CLIENT_LIMIT; i++) {
            expect((await call({ path: '/probe/open', token: bearer, ip: `10.1.0.${i}` })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', token: bearer, ip: '10.1.0.9' })).statusCode).toBe(429);
    });

    it('ignores an unverifiable bearer token and falls back to the IP', async () => {
        const ip = '10.0.0.5';

        for (let i = 0; i < ACCOUNT_LIMIT; i++) {
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

    it('gives token refresh its own bucket, separate from both other budgets', async () => {
        const ip = '10.0.0.7';

        // Exhausting the general budget must not block a refresh…
        for (let i = 0; i < ACCOUNT_LIMIT; i++) {
            expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/open', ip })).statusCode).toBe(429);
        expect((await call({ path: '/probe/refresh', ip })).statusCode).toBe(200);

        // …nor may refreshes eat the sign-in budget.
        expect((await call({ path: '/probe/strict', ip })).statusCode).toBe(200);
    });

    it('still bounds refreshes at their own limit', async () => {
        const ip = '10.0.0.8';

        for (let i = 0; i < REFRESH_LIMIT; i++) {
            expect((await call({ path: '/probe/refresh', ip })).statusCode).toBe(200);
        }

        expect((await call({ path: '/probe/refresh', ip })).statusCode).toBe(429);
    });

    describe('per-client fence', () => {
        it('stops one client of a user from starving that user’s other clients', async () => {
            const ip = '10.2.0.1';
            const cron = token({ sub: 'user-fence', clientId: 'cli' });
            const browser = token({ sub: 'user-fence', clientId: 'web' });

            for (let i = 0; i < CLIENT_LIMIT; i++) {
                expect((await call({ path: '/probe/open', token: cron, ip })).statusCode).toBe(200);
            }

            const blocked = await call({ path: '/probe/open', token: cron, ip });

            expect(blocked.statusCode).toBe(429);
            expect(blocked.json().message).toContain('This client');

            // The account still has budget left, so the other client gets through.
            expect((await call({ path: '/probe/open', token: browser, ip })).statusCode).toBe(200);
        });

        it('still enforces the account ceiling across a user’s clients', async () => {
            const ip = '10.2.0.2';
            const clients = ['a', 'b', 'c'].map((clientId) => token({ sub: 'user-ceiling', clientId }));

            // Two clients, each inside its own fence, together reach the account ceiling.
            for (const bearer of clients.slice(0, 2)) {
                for (let i = 0; i < CLIENT_LIMIT; i++) {
                    expect((await call({ path: '/probe/open', token: bearer, ip })).statusCode).toBe(200);
                }
            }

            const blocked = await call({ path: '/probe/open', token: clients[2]!, ip });

            expect(blocked.statusCode).toBe(429);
            expect(blocked.json().message).not.toContain('This client');
        });

        it('keeps a token with no client id off the first-party fence', async () => {
            const ip = '10.2.0.4';
            const login = token({ sub: 'user-mixed' });
            const unregistered = token({ sub: 'user-mixed', clientId: UNREGISTERED_CLIENT });

            for (let i = 0; i < CLIENT_LIMIT; i++) {
                expect((await call({ path: '/probe/open', token: unregistered, ip })).statusCode).toBe(200);
            }

            expect((await call({ path: '/probe/open', token: unregistered, ip })).statusCode).toBe(429);
            expect((await call({ path: '/probe/open', token: login, ip })).statusCode).toBe(200);
        });

        it('does not fence anonymous traffic, which has no client dimension', async () => {
            const ip = '10.2.0.3';

            // Without the skip, the tighter client limit would become the anonymous ceiling.
            for (let i = 0; i < CLIENT_LIMIT + 1; i++) {
                expect((await call({ path: '/probe/open', ip })).statusCode).toBe(200);
            }
        });
    });
});
