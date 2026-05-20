import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';

describe('Well-known endpoints', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => { await app.close(); });

    it('GET /.well-known/openid-configuration returns OIDC metadata', async () => {
        const res = await app.inject({ method: 'GET', url: '/.well-known/openid-configuration' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('issuer');
        expect(body).toHaveProperty('authorization_endpoint');
        expect(body).toHaveProperty('token_endpoint');
        expect(body).toHaveProperty('jwks_uri');
        expect(body.id_token_signing_alg_values_supported).toContain('RS256');
    });

    it('GET /.well-known/oauth-authorization-server returns RFC 8414 metadata', async () => {
        const res = await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('token_endpoint');
        expect(body.code_challenge_methods_supported).toContain('S256');
    });

    it('GET /.well-known/jwks.json returns a key set with RS256 key', async () => {
        const res = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.keys).toHaveLength(1);
        expect(body.keys[0].alg).toBe('RS256');
        expect(body.keys[0].kty).toBe('RSA');
    });

    it('existing JWT auth still works with RS256 tokens', async () => {
        // Register + login to get a JWT
        const email = `wk+${Date.now()}@example.com`;
        await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'password123' } });
        const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'password123' } });
        const { accessToken } = JSON.parse(loginRes.body);

        // Use JWT on a protected route
        const meRes = await app.inject({ method: 'GET', url: '/users/me', headers: { authorization: `Bearer ${accessToken}` } });
        expect(meRes.statusCode).toBe(200);
    });
});
