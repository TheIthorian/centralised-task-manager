import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { createHash, randomBytes } from 'crypto';

function makeCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function makeCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

describe('OAuth endpoints', () => {
    let app: NestFastifyApplication;
    let jwt: string;
    const email = `oauth+${Date.now()}@example.com`;
    const password = 'password123';

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = module.createNestApplication(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password } });
        const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
        jwt = JSON.parse(loginRes.body).accessToken;
    });

    afterAll(async () => { await app.close(); });

    it('GET /oauth/authorize returns HTML login form', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const res = await app.inject({
            method: 'GET',
            url: `/oauth/authorize?response_type=code&redirect_uri=http://localhost:4000/cb&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.body).toContain('<form');
    });

    it('POST /oauth/authorize redirects with code on valid credentials', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const res = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid&state=xyz`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        });
        expect(res.statusCode).toBe(302);
        const location = res.headers['location'] as string;
        expect(location).toContain('code=');
        expect(location).toContain('state=xyz');
    });

    it('POST /oauth/token exchanges code for tokens', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        // Get code
        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        });
        const location = authorizeRes.headers['location'] as string;
        const code = new URL(location).searchParams.get('code')!;

        // Exchange for tokens
        const tokenRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier },
        });
        expect(tokenRes.statusCode).toBe(200);
        const body = JSON.parse(tokenRes.body);
        expect(body).toHaveProperty('access_token');
        expect(body).toHaveProperty('id_token');
        expect(body.token_type).toBe('Bearer');
    });

    it('POST /oauth/token rejects wrong code_verifier', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        });
        const location = authorizeRes.headers['location'] as string;
        const code = new URL(location).searchParams.get('code')!;

        const tokenRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: 'wrong-verifier' },
        });
        expect(tokenRes.statusCode).toBe(400);
    });

    it('GET /oauth/userinfo returns claims for authenticated user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/oauth/userinfo',
            headers: { authorization: `Bearer ${jwt}` },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('sub');
        expect(body.email).toBe(email);
    });

    it('GET /oauth/userinfo returns 401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: '/oauth/userinfo' });
        expect(res.statusCode).toBe(401);
    });
});
