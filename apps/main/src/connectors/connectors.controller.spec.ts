import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('ConnectorsModule', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `connectors+${Date.now()}@example.com`;

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

    afterAll(async () => {
        await app.close();
    });

    it('GET /connectors returns available source names', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors', headers: { authorization: `Bearer ${jwt}` } });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(Array.isArray(body)).toBe(true);
        expect(body).toContain('todoist');
        expect(body).toContain('google_tasks');
    });

    it('GET /connectors/configs returns empty array for new user', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors/configs', headers: { authorization: `Bearer ${jwt}` } });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual([]);
    });

    it('POST /connectors/configs returns an OAuth URL', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/connectors/configs',
            payload: { source: 'todoist' },
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.url).toContain('todoist.com/oauth/authorize');
    });

    it('DELETE /connectors/configs/:id with non-existent id returns 404', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/connectors/configs/000000000000000000000000',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });
});
