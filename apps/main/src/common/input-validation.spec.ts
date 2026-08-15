import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../app.module.js';
import { AppErrorFilter } from './filters/app-error.filter.js';

/**
 * Malformed path, query and body input must produce a 4xx, never a 500. A CastError escaping
 * from Mongoose or an unbounded string reaching an outbound request both used to surface as 500.
 */
describe('handler input validation', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `validation+${Date.now()}@example.com`;
    const password = 'password123';

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalFilters(new AppErrorFilter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Validation Tester', email, password },
        });
        const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
        jwt = JSON.parse(loginRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    const auth = (): { authorization: string } => ({ authorization: `Bearer ${jwt}` });

    describe('ObjectId path params', () => {
        it.each([
            ['GET', '/tasks/not-an-objectid'],
            ['PATCH', '/tasks/not-an-objectid'],
            ['DELETE', '/tasks/not-an-objectid'],
            ['GET', '/tasks/{"$ne":null}'],
            ['POST', '/sync/connections/not-an-objectid/jobs'],
            ['GET', '/sync/jobs/not-an-objectid'],
            ['PATCH', '/notifications/not-an-objectid/read'],
        ])('%s %s is rejected as a bad request', async (method, url) => {
            const res = await app.inject({
                method: method as 'GET',
                url,
                headers: auth(),
                ...(method === 'PATCH' || method === 'POST' ? { payload: {} } : {}),
            });

            expect(res.statusCode).toBeGreaterThanOrEqual(400);
            expect(res.statusCode).toBeLessThan(500);
        });
    });

    describe('enum path params', () => {
        it('rejects an unknown notification channel', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/notifications/channels/carrier-pigeon/test',
                headers: auth(),
            });

            expect(res.statusCode).toBe(400);
        });

        it('rejects an unknown connector name', async () => {
            const res = await app.inject({ method: 'GET', url: '/connectors/facebook/auth', headers: auth() });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('numeric path params', () => {
        it('rejects a non-numeric reminder index', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/tasks/${'a'.repeat(24)}/reminders/not-a-number`,
                headers: auth(),
            });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('/oauth/authorize query', () => {
        const challenge = createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url');
        const base = `response_type=code&client_id=ctm-cli&redirect_uri=${encodeURIComponent('http://localhost:4000/cb')}&code_challenge=${challenge}`;

        it.each([
            ['a missing client_id', base.replace('client_id=ctm-cli&', '')],
            ['a missing redirect_uri', `response_type=code&client_id=ctm-cli&code_challenge=${challenge}`],
            [
                'a non-URL redirect_uri',
                `response_type=code&client_id=ctm-cli&redirect_uri=not-a-url&code_challenge=${challenge}`,
            ],
            ['an unsupported response_type', base.replace('response_type=code', 'response_type=token')],
            [
                'a missing code_challenge',
                `response_type=code&client_id=ctm-cli&redirect_uri=${encodeURIComponent('http://x/cb')}`,
            ],
            ['a truncated code_challenge', `${base.split('&code_challenge=')[0]}&code_challenge=tooshort`],
            ['an unsupported code_challenge_method', `${base}&code_challenge_method=plain`],
            ['an over-long state', `${base}&state=${'x'.repeat(513)}`],
        ])('rejects %s', async (_label, query) => {
            const res = await app.inject({ method: 'GET', url: `/oauth/authorize?${query}` });

            expect(res.statusCode).toBe(400);
        });

        it('ignores parameters the server does not implement', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/oauth/authorize?${base}&code_challenge_method=S256&nonce=abc&prompt=consent&resource=https%3A%2F%2Fapi.example.com`,
            });

            expect(res.statusCode).toBe(302);
        });
    });

    describe('POST /oauth/token body', () => {
        it.each([
            ['an unsupported grant_type', { grant_type: 'client_credentials' }],
            ['a missing grant_type', { code: 'abc' }],
            ['an over-long code_verifier', { grant_type: 'authorization_code', code_verifier: 'x'.repeat(129) }],
            ['a too-short code_verifier', { grant_type: 'authorization_code', code_verifier: 'short' }],
        ])('rejects %s', async (_label, payload) => {
            const res = await app.inject({ method: 'POST', url: '/oauth/token', payload });

            expect(res.statusCode).toBe(400);
        });
    });
});
