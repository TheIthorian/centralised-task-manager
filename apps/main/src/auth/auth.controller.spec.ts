import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('POST /auth/register + /auth/login', () => {
    let app: NestFastifyApplication;
    const email = `test+${Date.now()}@example.com`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('registers a new user and returns accessToken + refreshToken', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Test User', email, password: 'password123' } });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('accessToken');
        expect(body).toHaveProperty('refreshToken');
        expect(body).toHaveProperty('user');
    });

    it('rejects duplicate email with 409', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Test User', email, password: 'password123' } });

        expect(res.statusCode).toBe(409);
    });

    it('returns token pair on login', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('accessToken');
        expect(body).toHaveProperty('refreshToken');
        expect(body).toHaveProperty('user');
    });

    it('rejects wrong password with 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'wrong' } });

        expect(res.statusCode).toBe(401);
    });
});

describe('POST /auth/refresh', () => {
    let app: NestFastifyApplication;
    const email = `refresh+${Date.now()}@example.com`;
    let refreshToken: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        // Register and capture refresh token
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Refresh Tester', email, password: 'password123' },
        });
        const body = JSON.parse(res.body);

        refreshToken = body.refreshToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns a new token pair for a valid refresh token with status 200', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('accessToken');
        expect(body).toHaveProperty('refreshToken');
        expect(body).toHaveProperty('user');
        expect(typeof body.accessToken).toBe('string');
        expect(typeof body.refreshToken).toBe('string');

        // Capture the new refresh token for rotation check
        refreshToken = body.refreshToken;
    });

    it('returns 401 for an invalid/made-up refresh token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: 'rt_thisisnotavalidrefreshtoken00000000000000000000000000000000000' },
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 401 when the same refresh token is used twice (rotation)', async () => {
        // Get a fresh token pair via login
        const loginRes = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password: 'password123' },
        });
        const { refreshToken: freshToken } = JSON.parse(loginRes.body);

        // First use — should succeed
        const firstRes = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: freshToken },
        });

        expect(firstRes.statusCode).toBe(200);

        // Second use of same token — should fail (token was deleted)
        const secondRes = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: freshToken },
        });

        expect(secondRes.statusCode).toBe(401);
    });
});

describe('DELETE /users/me', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 204 and invalidates the refresh token', async () => {
        const email = `del-${Date.now()}@test.com`;
        const password = 'password123';

        // Register
        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Del User', email, password },
        });

        expect(regRes.statusCode).toBe(201);
        const { refreshToken, accessToken } = JSON.parse(regRes.body) as { refreshToken: string; accessToken: string };

        // Delete account using the access token
        const deleteRes = await app.inject({
            method: 'DELETE',
            url: '/users/me',
            headers: { authorization: `Bearer ${accessToken}` },
        });

        expect(deleteRes.statusCode).toBe(204);

        // Refresh token must now be invalid (401)
        const refreshRes = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken },
        });

        expect(refreshRes.statusCode).toBe(401);
    });
});
