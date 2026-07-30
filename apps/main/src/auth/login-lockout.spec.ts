import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import cookie from '@fastify/cookie';
import { AppModule } from '../app.module.js';

const MAX_ATTEMPTS = Number(process.env['LOGIN_MAX_FAILED_ATTEMPTS']);

describe('login lockout', () => {
    let app: NestFastifyApplication;
    const email = `lockout+${Date.now()}@example.com`;
    const password = 'password123';

    const login = (attempted: string) =>
        app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: attempted } });

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password } });
    });

    afterAll(async () => {
        await app.close();
    });

    it('locks the account with a 429 after repeated bad passwords', async () => {
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            expect((await login('wrong-password')).statusCode).toBe(401);
        }

        const locked = await login('wrong-password');

        expect(locked.statusCode).toBe(429);
        expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
        expect(locked.json()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
    });

    it('rejects the correct password too while the lock holds', async () => {
        expect((await login(password)).statusCode).toBe(429);
    });
});
