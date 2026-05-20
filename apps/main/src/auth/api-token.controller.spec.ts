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
