import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('WellKnownController', () => {
    let app: NestFastifyApplication;

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

    it('POST /.well-known/oauth-client registers a client and returns credentials', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                client_name: 'Test Client',
                redirect_uris: ['https://example.com/callback'],
            },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.client_id).toMatch(/^client_[0-9a-f]{32}$/);
        expect(body.client_secret).toMatch(/^[0-9a-f]{64}$/);
        expect(body.redirect_uris).toEqual(['https://example.com/callback']);
        expect(body.grant_types).toContain('authorization_code');
        expect(body.response_types).toContain('code');
        expect(body.scopes).toContain('openid');
        expect(body.issued_at).toBeDefined();
    });

    it('POST /.well-known/oauth-client applies default grant_types and scopes when omitted', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: { redirect_uris: ['https://app.example.com/cb'] },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.grant_types).toEqual(['authorization_code']);
        expect(body.response_types).toEqual(['code']);
        expect(body.scopes).toEqual(['openid', 'email', 'profile']);
    });

    it('POST /.well-known/oauth-client accepts custom grant_types and scopes', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                redirect_uris: ['https://app.example.com/cb'],
                grant_types: ['authorization_code', 'refresh_token'],
                scopes: ['openid', 'tasks:read'],
            },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.grant_types).toEqual(['authorization_code', 'refresh_token']);
        expect(body.scopes).toEqual(['openid', 'tasks:read']);
    });

    it('each registration produces a unique client_id and client_secret', async () => {
        const makeClient = (): Promise<{ client_id: string; client_secret: string }> =>
            app
                .inject({
                    method: 'POST',
                    url: '/.well-known/oauth-client',
                    payload: { redirect_uris: ['https://example.com/cb'] },
                })
                .then((r) => JSON.parse(r.body));

        const [a, b] = await Promise.all([makeClient(), makeClient()]);

        expect(a.client_id).not.toBe(b.client_id);
        expect(a.client_secret).not.toBe(b.client_secret);
    });
});
