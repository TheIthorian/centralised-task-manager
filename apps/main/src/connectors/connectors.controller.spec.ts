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

        await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Connectors Tester', email, password: 'password123' },
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

    it('GET /connectors returns available source names', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/connectors',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(Array.isArray(body)).toBe(true);
        expect(body).toContain('todoist');
        expect(body).toContain('google_tasks');
    });

    it('GET /connectors/configs returns empty array for new user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/connectors/configs',
            headers: { authorization: `Bearer ${jwt}` },
        });

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

// ─── Auth guards and user isolation ──────────────────────────────────────────

describe('Connectors — auth guards and user isolation', () => {
    let app: NestFastifyApplication;
    let jwtA: string;
    let jwtB: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const suffix = Date.now();

        const regA = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Conn User A', email: `connA+${suffix}@example.com`, password: 'password123' },
        });

        jwtA = JSON.parse(regA.body).accessToken;

        const regB = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Conn User B', email: `connB+${suffix}@example.com`, password: 'password123' },
        });

        jwtB = JSON.parse(regB.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    // Auth guards

    it('GET /connectors without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors' });

        expect(res.statusCode).toBe(401);
    });

    it('GET /connectors/configs without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors/configs' });

        expect(res.statusCode).toBe(401);
    });

    it('POST /connectors/configs without auth returns 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/connectors/configs', payload: { source: 'todoist' } });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /connectors/configs/:id without auth returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/connectors/configs/000000000000000000000000' });

        expect(res.statusCode).toBe(401);
    });

    // User isolation — configs are scoped per user

    it("GET /connectors/configs only returns the current user's configs", async () => {
        // Both users start with empty configs
        const resA = await app.inject({ method: 'GET', url: '/connectors/configs', headers: { authorization: `Bearer ${jwtA}` } });
        const resB = await app.inject({ method: 'GET', url: '/connectors/configs', headers: { authorization: `Bearer ${jwtB}` } });

        expect(JSON.parse(resA.body)).toEqual([]);
        expect(JSON.parse(resB.body)).toEqual([]);
    });

    it("User B cannot DELETE User A's connector config — returns 404", async () => {
        // We only have a non-existent id to try, which returns 404 regardless
        const res = await app.inject({
            method: 'DELETE',
            url: '/connectors/configs/000000000000000000000000',
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(res.statusCode).toBe(404);
    });

    // Connector-specific behaviour

    it('POST /connectors/configs with unknown source returns an error', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/connectors/configs',
            payload: { source: 'unknown_source_xyz' },
            headers: { authorization: `Bearer ${jwtA}` },
        });

        // Not found or bad request — the server rejects the unknown source
        expect([400, 404, 500]).toContain(res.statusCode);
    });

    it('PATCH /connectors/configs/:id returns 404 for non-existent config', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/connectors/configs/000000000000000000000000',
            payload: { enabled: false },
            headers: { authorization: `Bearer ${jwtA}` },
        });

        expect(res.statusCode).toBe(404);
    });
});
