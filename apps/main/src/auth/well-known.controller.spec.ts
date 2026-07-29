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

    it('POST /.well-known/oauth-client ignores unrecognised RFC 7591 metadata', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                client_name: 'Metadata Client',
                redirect_uris: ['https://example.com/cb'],
                logo_uri: 'https://example.com/logo.png',
                contacts: ['ops@example.com'],
                token_endpoint_auth_method: 'none',
            },
        });

        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).client_name).toBe('Metadata Client');
    });

    it.each([
        ['no redirect_uris', {}],
        ['empty redirect_uris', { redirect_uris: [] }],
        ['redirect_uris not an array', { redirect_uris: 'https://example.com/cb' }],
        ['javascript scheme', { redirect_uris: ['javascript:alert(1)'] }],
        ['data scheme', { redirect_uris: ['data:text/html,hi'] }],
        ['http on a non-loopback host', { redirect_uris: ['http://evil.example.com/cb'] }],
        ['a fragment', { redirect_uris: ['https://example.com/cb#frag'] }],
        ['a relative uri', { redirect_uris: ['/callback'] }],
        ['too many redirect_uris', { redirect_uris: Array.from({ length: 9 }, (_, i) => `https://e.com/${i}`) }],
        ['an unsupported grant_type', { redirect_uris: ['https://e.com/cb'], grant_types: ['client_credentials'] }],
        ['an unsupported response_type', { redirect_uris: ['https://e.com/cb'], response_types: ['token'] }],
        ['a control character in client_name', { redirect_uris: ['https://e.com/cb'], client_name: 'bad\u0000name' }],
        ['an over-long client_name', { redirect_uris: ['https://e.com/cb'], client_name: 'x'.repeat(101) }],
    ])('POST /.well-known/oauth-client rejects %s', async (_label, payload) => {
        const res = await app.inject({ method: 'POST', url: '/.well-known/oauth-client', payload });

        expect(res.statusCode).toBe(400);
    });

    it('POST /.well-known/oauth-client accepts http on loopback hosts', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: { redirect_uris: ['http://127.0.0.1:8976/callback', 'http://localhost:1234/cb'] },
        });

        expect(res.statusCode).toBe(201);
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
