import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('GET /users/me + PATCH /users/me', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `users+${Date.now()}@example.com`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Users Tester', email, password: 'password123' },
        });
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password: 'password123' },
        });
        jwt = JSON.parse(res.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /users/me returns the current user', async () => {
        const res = await app.inject({ method: 'GET', url: '/users/me', headers: { authorization: `Bearer ${jwt}` } });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.email).toBe(email);
        expect(body).toHaveProperty('id');
    });

    it('GET /users/me without token returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/users/me' });
        expect(res.statusCode).toBe(401);
    });

    it('PATCH /users/me updates the email', async () => {
        const newEmail = `updated+${Date.now()}@example.com`;
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { email: newEmail },
            headers: { authorization: `Bearer ${jwt}` },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).email).toBe(newEmail);
    });
});

// ─── Auth guards and validation ───────────────────────────────────────────────

describe('Users — auth guards, validation, persistence', () => {
    let app: NestFastifyApplication;
    let jwt: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const email = `users-v+${Date.now()}@example.com`;
        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Validation Tester', email, password: 'password123' },
        });

        jwt = JSON.parse(regRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    // Auth guards

    it('GET /users/me without token returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/users/me' });

        expect(res.statusCode).toBe(401);
    });

    it('PATCH /users/me without token returns 401', async () => {
        const res = await app.inject({ method: 'PATCH', url: '/users/me', payload: { email: 'x@x.com' } });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /users/me without token returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/users/me' });

        expect(res.statusCode).toBe(401);
    });

    // Validation

    it('PATCH /users/me with invalid email format returns 400', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { email: 'not-an-email' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('PATCH /users/me with email longer than max length returns 400', async () => {
        const local = 'a'.repeat(310);
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { email: `${local}@example.com` },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('PATCH /users/me with password shorter than 8 chars returns 400', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { password: 'short' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    it('PATCH /users/me with unknown extra fields returns 400', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { role: 'admin' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(400);
    });

    // Persistence

    it('PATCH /users/me email update is persisted — GET /users/me reflects the new value', async () => {
        const newEmail = `updated+${Date.now()}@example.com`;

        const patchRes = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { email: newEmail },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(patchRes.statusCode).toBe(200);
        expect(JSON.parse(patchRes.body).email).toBe(newEmail);

        const getRes = await app.inject({
            method: 'GET',
            url: '/users/me',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(JSON.parse(getRes.body).email).toBe(newEmail);
    });

    it('DELETE /users/me removes the account — login afterwards returns 401', async () => {
        const email = `todelete+${Date.now()}@example.com`;
        const password = 'password123';

        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Deletable', email, password },
        });
        const deleteJwt = JSON.parse(regRes.body).accessToken;

        const deleteRes = await app.inject({
            method: 'DELETE',
            url: '/users/me',
            headers: { authorization: `Bearer ${deleteJwt}` },
        });

        expect(deleteRes.statusCode).toBe(204);

        // Login with deleted account's credentials
        const loginRes = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email, password },
        });

        expect(loginRes.statusCode).toBe(401);
    });
});
