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

        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Connectors Tester', email, password: 'password123' },
        });

        jwt = JSON.parse(regRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /connectors returns available connectors with status', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/connectors',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Array<{ source: string }>;
        const sources = body.map((c) => c.source);

        expect(Array.isArray(body)).toBe(true);
        expect(sources).toContain('todoist');
        expect(sources).toContain('google_tasks');
    });

    it('GET /connectors/:connectorName/auth returns an OAuth URL', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/connectors/todoist/auth',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);

        expect(body.url).toContain('todoist.com/oauth/authorize');
    });

    it('DELETE /connectors/:connectorName with no connected config returns 404', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/connectors/todoist',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it('PATCH /connectors/configs/:id returns 404 for non-existent config', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/connectors/configs/000000000000000000000000',
            payload: { enabled: false },
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

    it('GET /connectors without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors' });

        expect(res.statusCode).toBe(401);
    });

    it('GET /connectors/:connectorName/auth without auth returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/connectors/todoist/auth' });

        expect(res.statusCode).toBe(401);
    });

    it('DELETE /connectors/:connectorName without auth returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/connectors/todoist' });

        expect(res.statusCode).toBe(401);
    });

    it('PATCH /connectors/configs/:id without auth returns 401', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/connectors/configs/000000000000000000000000',
            payload: { enabled: false },
        });

        expect(res.statusCode).toBe(401);
    });

    it("both users see all connectors as disconnected", async () => {
        const resA = await app.inject({
            method: 'GET',
            url: '/connectors',
            headers: { authorization: `Bearer ${jwtA}` },
        });
        const resB = await app.inject({
            method: 'GET',
            url: '/connectors',
            headers: { authorization: `Bearer ${jwtB}` },
        });

        const bodyA = JSON.parse(resA.body) as Array<{ connected: boolean }>;
        const bodyB = JSON.parse(resB.body) as Array<{ connected: boolean }>;

        expect(bodyA.every((c) => !c.connected)).toBe(true);
        expect(bodyB.every((c) => !c.connected)).toBe(true);
    });

    it('POST /connectors/:connectorName/connection-details with unknown connector returns error', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/connectors/unknown_xyz/connection-details',
            payload: {},
            headers: { authorization: `Bearer ${jwtA}` },
        });

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
