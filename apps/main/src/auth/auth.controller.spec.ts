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
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test User', email, password: 'password123' },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body).toHaveProperty('accessToken');
        expect(body).toHaveProperty('refreshToken');
        expect(body).toHaveProperty('user');
    });

    it('rejects duplicate email with 409', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test User', email, password: 'password123' },
        });

        expect(res.statusCode).toBe(409);
    });

    it('returns token pair on login', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password: 'password123' },
        });

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

// ─── Validation ──────────────────────────────────────────────────────────────

describe('POST /auth/register — input validation', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('rejects missing name with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { email: 'a@example.com', password: 'password123' },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects missing email with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test', password: 'password123' },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects a non-email string with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test', email: 'not-an-email', password: 'password123' },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects password shorter than 8 characters with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test', email: 'b@example.com', password: 'short' },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects name longer than max length with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: {
                name: 'x'.repeat(101),
                email: 'toolong@example.com',
                password: 'password123',
            },
        });

        expect(res.statusCode).toBe(400);
    });

    it('rejects an empty body with 400', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/register', payload: {} });

        expect(res.statusCode).toBe(400);
    });

    it('rejects unknown extra fields with 400', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Test', email: 'c@example.com', password: 'password123', role: 'admin' },
        });

        expect(res.statusCode).toBe(400);
    });
});

// ─── Persistence ─────────────────────────────────────────────────────────────

describe('POST /auth/register — persistence', () => {
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

    it('registered user can log in with the same credentials', async () => {
        const email = `persist+${Date.now()}@example.com`;
        const password = 'password123';

        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Persist User', email, password },
        });

        expect(regRes.statusCode).toBe(201);

        const loginRes = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password },
        });

        expect(loginRes.statusCode).toBe(200);
        expect(JSON.parse(loginRes.body)).toHaveProperty('accessToken');
    });

    it('register response includes user id and email but not the password', async () => {
        const email = `shape+${Date.now()}@example.com`;

        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Shape User', email, password: 'password123' },
        });

        const body = JSON.parse(res.body);

        expect(body.user).toHaveProperty('id');
        expect(body.user.email).toBe(email);
        expect(body).not.toHaveProperty('password');
    });

    it('duplicate email returns 409 — user was actually stored', async () => {
        const email = `dup+${Date.now()}@example.com`;

        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'First', email, password: 'password123' },
        });

        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Second', email, password: 'password123' },
        });

        expect(res.statusCode).toBe(409);
    });
});

// ─── JWT key mismatch ─────────────────────────────────────────────────────────

describe('JWT signed with a mismatched key', () => {
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

    it('returns 401 when access token is signed with a different RSA key', async () => {
        const { generateKeyPairSync, createSign } = await import('node:crypto');

        const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: 'fake-user-id', email: 'fake@example.com', iat: Math.floor(Date.now() / 1000) })).toString('base64url');
        const signer = createSign('SHA256');
        signer.update(`${header}.${payload}`);
        const signature = signer.sign(privateKey, 'base64url');
        const fakeToken = `${header}.${payload}.${signature}`;

        const res = await app.inject({
            method: 'GET',
            url: '/tasks',
            headers: { authorization: `Bearer ${fakeToken}` },
        });

        expect(res.statusCode).toBe(401);
    });
});
