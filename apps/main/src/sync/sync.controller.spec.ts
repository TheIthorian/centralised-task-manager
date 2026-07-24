// apps/main/src/sync/sync.controller.spec.ts
import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module.js';
import {
    ConnectorConfig,
    type ConnectorConfigDocument,
} from '../connectors/schemas/connector-config.schema.js';

describe('SyncController', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    let connectionId: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        app.useWebSocketAdapter(new IoAdapter(app));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const email = `sync+${Date.now()}@example.com`;

        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Sync Tester', email, password: 'password123' },
        });

        const body = JSON.parse(res.body);

        jwt = body.accessToken;

        const configModel = app.get<Model<ConnectorConfigDocument>>(getModelToken(ConnectorConfig.name));
        const config = await configModel.create({
            userId: new Types.ObjectId(body.user.id as string),
            source: 'todoist',
            externalAccountId: `ext-${Date.now()}`,
            accessToken: 'enc',
            refreshToken: 'enc',
            tokenExpiresAt: new Date(Date.now() + 3600_000),
            enabled: true,
        });

        connectionId = String(config._id);
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST sync without auth returns 401', async () => {
        const res = await app.inject({ method: 'POST', url: '/connectors/connections/000000000000000000000000/sync' });

        expect(res.statusCode).toBe(401);
    });

    it('GET sync/:jobId returns 404 for unknown job', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/connectors/connections/${connectionId}/sync/000000000000000000000000`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it('DELETE sync/:jobId returns 404 for unknown job', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/connectors/connections/${connectionId}/sync/000000000000000000000000`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(res.statusCode).toBe(404);
    });

    it('POST creates a job and GET retrieves it', async () => {
        const postRes = await app.inject({
            method: 'POST',
            url: `/connectors/connections/${connectionId}/sync`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        // Job is always created (async execution happens in background)
        expect(postRes.statusCode).toBe(201);
        const body = JSON.parse(postRes.body) as { id: string; status: string; source: string };

        expect(body.id).toBeTruthy();
        expect(body.source).toBe('todoist');
        expect(['queued', 'running', 'failed']).toContain(body.status);

        const getRes = await app.inject({
            method: 'GET',
            url: `/connectors/connections/${connectionId}/sync/${body.id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(getRes.statusCode).toBe(200);
        const getBody = JSON.parse(getRes.body) as { id: string };

        expect(getBody.id).toBe(body.id);
    });

    it('DELETE cancels a job', async () => {
        const postRes = await app.inject({
            method: 'POST',
            url: `/connectors/connections/${connectionId}/sync`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        const { id } = JSON.parse(postRes.body) as { id: string };

        const delRes = await app.inject({
            method: 'DELETE',
            url: `/connectors/connections/${connectionId}/sync/${id}`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        expect(delRes.statusCode).toBe(204);
    });

    it('User B cannot access User A sync jobs', async () => {
        const postRes = await app.inject({
            method: 'POST',
            url: `/connectors/connections/${connectionId}/sync`,
            headers: { authorization: `Bearer ${jwt}` },
        });

        const { id } = JSON.parse(postRes.body) as { id: string };

        const emailB = `syncB+${Date.now()}@example.com`;
        const regB = await app.inject({
            method: 'POST',
            url: '/auth/register',
            payload: { name: 'Sync User B', email: emailB, password: 'password123' },
        });
        const jwtB = JSON.parse(regB.body).accessToken as string;

        const getRes = await app.inject({
            method: 'GET',
            url: `/connectors/connections/${connectionId}/sync/${id}`,
            headers: { authorization: `Bearer ${jwtB}` },
        });

        expect(getRes.statusCode).toBe(403);
    });
});
