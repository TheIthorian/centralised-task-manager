import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('API token routes', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `apitok+${Date.now()}@example.com`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        // register + login to get JWT
        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'API Token Tester', email, password: 'password123' },
        });
        const loginRes = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password: 'password123' },
        });

        jwt = JSON.parse(loginRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /auth/tokens issues a ctm_ token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: 'my cli token' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.token).toMatch(/^ctm_/);
        expect(body.label).toBe('my cli token');
    });

    it('GET /auth/tokens lists issued tokens', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/auth/tokens',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const tokens = JSON.parse(res.body);

        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens.length).toBeGreaterThan(0);
    });

    it('protected endpoint works with ctm_ token', async () => {
        // issue a token
        const issueRes = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: 'test' },
            headers: { authorization: `Bearer ${jwt}` },
        });
        const { token } = JSON.parse(issueRes.body);

        // use it to hit GET /auth/tokens (requires auth)
        const res = await app.inject({
            method: 'GET',
            url: '/auth/tokens',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(res.statusCode).toBe(200);
    });

    it('invalid ctm_ token returns 401', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/auth/tokens',
            headers: { authorization: 'Bearer ctm_invalid' },
        });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /auth/tokens/:id revokes a token', async () => {
        const issueRes = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: 'to delete' },
            headers: { authorization: `Bearer ${jwt}` },
        });
        const { id } = JSON.parse(issueRes.body);

        const deleteRes = await app.inject({
            method: 'DELETE',
            url: `/auth/tokens/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(deleteRes.statusCode).toBe(204);
    });
});

// ─── Auth guards, validation, user isolation ─────────────────────────────────

describe('API token routes — auth guards, validation, isolation', () => {
    let app: NestFastifyApplication;
    let jwtA: string;
    let jwtB: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const suffix = Date.now();

        const regA = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'User A', email: `tokA+${suffix}@example.com`, password: 'password123' },
        });

        jwtA = JSON.parse(regA.body).accessToken;

        const regB = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'User B', email: `tokB+${suffix}@example.com`, password: 'password123' },
        });

        jwtB = JSON.parse(regB.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    // Auth guards

    it('POST /auth/tokens without auth returns 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/tokens', payload: { label: 'test' } });

        expect(res.statusCode).toBe(401);
    });

    it('GET /auth/tokens without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/auth/tokens' });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /auth/tokens/:id without auth returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/auth/tokens/000000000000000000000000' });

        expect(res.statusCode).toBe(401);
    });

    // Validation

    it('POST /auth/tokens with missing label returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: {},
            headers: { authorization: `Bearer ${jwtA}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /auth/tokens with empty label string returns 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: '' },
            headers: { authorization: `Bearer ${jwtA}` },
        });

        expect(res.statusCode).toBe(400);
    });

    // User isolation

    it("User B cannot revoke User A's token — returns 404", async () => {
        const issueRes = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: 'isolation test' },
            headers: { authorization: `Bearer ${jwtA}` },
        });
        const { id } = JSON.parse(issueRes.body);

        const res = await app.inject({
            method: 'DELETE',
            url: `/auth/tokens/${id}`,
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    // Persistence

    it('after revoking a ctm_ token it can no longer authenticate', async () => {
        const issueRes = await app.inject({
            method: 'POST',
            url: '/auth/tokens',
            payload: { label: 'revoke-check' },
            headers: { authorization: `Bearer ${jwtA}` },
        });
        const { token, id } = JSON.parse(issueRes.body);

        // Token works before revoke
        const before = await app.inject({
            method: 'GET',
            url: '/auth/tokens',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(before.statusCode).toBe(200);

        // Revoke
        await app.inject({
            method: 'DELETE',
            url: `/auth/tokens/${id}`,
            headers: { authorization: `Bearer ${jwtA}` },
        });

        // Token no longer works
        const after = await app.inject({
            method: 'GET',
            url: '/auth/tokens',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(after.statusCode).toBe(401);
    });
});
