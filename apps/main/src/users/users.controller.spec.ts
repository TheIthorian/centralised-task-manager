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

        await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'password123' } });
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } });
        jwt = JSON.parse(res.body).accessToken;
    });

    afterAll(async () => { await app.close(); });

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
