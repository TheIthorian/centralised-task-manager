import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('WellKnownController', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /.well-known/oauth-client registers a public client', async () => {
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
        expect(body.token_endpoint_auth_method).toBe('none');
        expect(body).not.toHaveProperty('client_secret');
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
            payload: { client_name: 'Defaults Client', redirect_uris: ['https://app.example.com/cb'] },
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
                client_name: 'Custom Grants Client',
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
                token_endpoint_auth_method: 'none',
                software_version: '1.2.3',
                jwks_uri: 'https://example.com/jwks.json',
            },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.client_name).toBe('Metadata Client');
        expect(body.software_version).toBeUndefined();
        expect(body.jwks_uri).toBeUndefined();
        // Unlike the two above, this one is a registered property of the client, so the server
        // answers with the value it assigned rather than dropping the field.
        expect(body.token_endpoint_auth_method).toBe('none');
    });

    it('POST /.well-known/oauth-client stores and echoes display metadata', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                client_name: 'Display Metadata Client',
                redirect_uris: ['https://example.com/cb'],
                logo_uri: 'https://example.com/logo.png',
                client_uri: 'https://example.com',
                tos_uri: 'https://example.com/tos',
                policy_uri: 'https://example.com/privacy',
                contacts: ['ops@example.com'],
                software_id: 'example-client',
            },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.logo_uri).toBe('https://example.com/logo.png');
        expect(body.client_uri).toBe('https://example.com');
        expect(body.tos_uri).toBe('https://example.com/tos');
        expect(body.policy_uri).toBe('https://example.com/privacy');
        expect(body.contacts).toEqual(['ops@example.com']);
        expect(body.software_id).toBe('example-client');
    });

    it.each([
        ['no client_name', { redirect_uris: ['https://e.com/cb'] }],
        ['an empty client_name', { client_name: '', redirect_uris: ['https://e.com/cb'] }],
        ['no redirect_uris', { client_name: 'x' }],
        ['empty redirect_uris', { client_name: 'x', redirect_uris: [] }],
        ['redirect_uris not an array', { client_name: 'x', redirect_uris: 'https://example.com/cb' }],
        ['javascript scheme', { client_name: 'x', redirect_uris: ['javascript:alert(1)'] }],
        ['data scheme', { client_name: 'x', redirect_uris: ['data:text/html,hi'] }],
        ['a websocket scheme', { client_name: 'x', redirect_uris: ['ws://example.com/cb'] }],
        ['a private-use scheme', { client_name: 'x', redirect_uris: ['com.example.app:/cb'] }],
        ['http on a non-loopback host', { client_name: 'x', redirect_uris: ['http://evil.example.com/cb'] }],
        ['a fragment', { client_name: 'x', redirect_uris: ['https://example.com/cb#frag'] }],
        ['a relative uri', { client_name: 'x', redirect_uris: ['/callback'] }],
        [
            'too many redirect_uris',
            { client_name: 'x', redirect_uris: Array.from({ length: 9 }, (_, i) => `https://e.com/${i}`) },
        ],
        [
            'an unsupported grant_type',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], grant_types: ['client_credentials'] },
        ],
        [
            'an unsupported response_type',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], response_types: ['token'] },
        ],
        ['a control character in client_name', { redirect_uris: ['https://e.com/cb'], client_name: 'bad\u0000name' }],
        ['an over-long client_name', { redirect_uris: ['https://e.com/cb'], client_name: 'x'.repeat(101) }],
        [
            'a http logo_uri',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], logo_uri: 'http://e.com/logo.png' },
        ],
        [
            'a loopback logo_uri',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], logo_uri: 'http://localhost/logo.png' },
        ],
        [
            'a javascript client_uri',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], client_uri: 'javascript:alert(1)' },
        ],
        ['a relative tos_uri', { client_name: 'x', redirect_uris: ['https://e.com/cb'], tos_uri: '/tos' }],
        [
            'a policy_uri with a fragment',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], policy_uri: 'https://e.com/p#f' },
        ],
        ['a non-email contact', { client_name: 'x', redirect_uris: ['https://e.com/cb'], contacts: ['not-an-email'] }],
        [
            'too many contacts',
            {
                client_name: 'x',
                redirect_uris: ['https://e.com/cb'],
                contacts: Array.from({ length: 6 }, (_, i) => `ops${i}@e.com`),
            },
        ],
        [
            'a control character in software_id',
            { client_name: 'x', redirect_uris: ['https://e.com/cb'], software_id: 'bad\u0000id' },
        ],
    ])('POST /.well-known/oauth-client rejects %s', async (_label, payload) => {
        const res = await app.inject({ method: 'POST', url: '/.well-known/oauth-client', payload });

        expect(res.statusCode).toBe(400);
    });

    it('POST /.well-known/oauth-client accepts http on loopback hosts', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                client_name: 'Loopback Client',
                redirect_uris: ['http://127.0.0.1:8976/callback', 'http://localhost:1234/cb'],
            },
        });

        expect(res.statusCode).toBe(201);
    });

    it('each registration produces a unique client_id', async () => {
        const makeClient = (): Promise<{ client_id: string }> =>
            app
                .inject({
                    method: 'POST',
                    url: '/.well-known/oauth-client',
                    payload: { client_name: 'Unique Client', redirect_uris: ['https://example.com/cb'] },
                })
                .then((r) => JSON.parse(r.body));

        const [a, b] = await Promise.all([makeClient(), makeClient()]);

        expect(a.client_id).not.toBe(b.client_id);
    });

    it('POST /.well-known/oauth-client ignores a requested confidential auth method', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/.well-known/oauth-client',
            payload: {
                client_name: 'Confidential Hopeful',
                redirect_uris: ['https://example.com/cb'],
                token_endpoint_auth_method: 'client_secret_basic',
            },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);

        expect(body.token_endpoint_auth_method).toBe('none');
        expect(body).not.toHaveProperty('client_secret');
    });
});
