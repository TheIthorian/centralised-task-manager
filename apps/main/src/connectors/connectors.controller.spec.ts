import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { ConnectorName } from '@ctm/connectors';
import { ConnectorConfig, type ConnectorConfigDocument } from '@ctm/db';

describe('ConnectorsModule', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    let configModel: Model<ConnectorConfigDocument>;
    const email = `connectors+${Date.now()}@example.com`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Connectors Tester', email, password: 'password123' },
        });

        jwt = JSON.parse(regRes.body).accessToken;
        configModel = app.get<Model<ConnectorConfigDocument>>(getModelToken(ConnectorConfig.name));
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

    it('GET /connectors groups accounts under each source', async () => {
        const regRes = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: {
                name: 'Connectors Grouper',
                email: `connectors-group+${Date.now()}@example.com`,
                password: 'password123',
            },
        });
        const regBody = JSON.parse(regRes.body);
        const groupJwt: string = regBody.accessToken;
        const groupUserId: string = regBody.user.id;

        const base = {
            userId: new Types.ObjectId(groupUserId),
            accessToken: 'enc',
            refreshToken: 'enc',
            tokenExpiresAt: new Date(Date.now() + 3600_000),
            enabled: true,
        };

        await configModel.create([
            { ...base, source: ConnectorName.GoogleTasks, externalAccountId: 'ext-A', email: 'a@x.com' },
            { ...base, source: ConnectorName.GoogleTasks, externalAccountId: 'ext-B', email: 'b@x.com' },
            { ...base, source: ConnectorName.Notion, externalAccountId: 'ext-C', email: null },
        ]);

        const res = await app.inject({
            method: 'GET',
            url: '/connectors',
            headers: { authorization: `Bearer ${groupJwt}` },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Array<{
            source: string;
            accounts: Array<{ connectionId: string; externalAccountId: string; email: string | null }>;
        }>;

        const google = body.find((c) => c.source === 'google_tasks');

        expect(google!.accounts.map((a) => a.externalAccountId).sort()).toEqual(['ext-A', 'ext-B']);
        expect(google!.accounts.every((a) => typeof a.connectionId === 'string')).toBe(true);

        const notion = body.find((c) => c.source === 'notion');

        expect(notion!.accounts).toHaveLength(1);
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

    it('DELETE /connectors/connections/:connectionId with unknown id returns 404', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/connectors/connections/000000000000000000000000',
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

    it('GET /connectors/health returns [] when no connectors are connected', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/connectors/health',
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual([]);
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

    it('DELETE /connectors/connections/:connectionId without auth returns 401', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/connectors/connections/000000000000000000000000' });

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

    it('both users see all connectors with no accounts', async () => {
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

        const bodyA = JSON.parse(resA.body) as Array<{ accounts: unknown[] }>;
        const bodyB = JSON.parse(resB.body) as Array<{ accounts: unknown[] }>;

        expect(bodyA.every((c) => c.accounts.length === 0)).toBe(true);
        expect(bodyB.every((c) => c.accounts.length === 0)).toBe(true);
    });

    it('POST /connectors/connections/:connectionId/connection-details with unknown connection returns error', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/connectors/connections/000000000000000000000000/connection-details',
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
