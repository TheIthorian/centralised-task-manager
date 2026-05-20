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

    it('registers a new user and returns accessToken', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'password123' } });

        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body)).toHaveProperty('accessToken');
    });

    it('rejects duplicate email with 409', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'password123' } });

        expect(res.statusCode).toBe(409);
    });

    it('returns JWT on login', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toHaveProperty('accessToken');
    });

    it('rejects wrong password with 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'wrong' } });

        expect(res.statusCode).toBe(401);
    });
});
