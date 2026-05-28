import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { createHash, randomBytes } from 'crypto';
import { SCOPE_REGISTRY, filterScopes, groupScopesByResource } from './scopes.js';

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

        await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'OAuth Tester', email, password } });
        const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
        jwt = JSON.parse(loginRes.body).accessToken;
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /oauth/authorize redirects to /oauth/consent with params', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const res = await app.inject({
            method: 'GET',
            url: `/oauth/authorize?response_type=code&redirect_uri=http://localhost:4000/cb&code_challenge=${challenge}&code_challenge_method=S256&scope=tasks:read`,
        });
        expect(res.statusCode).toBe(302);
        const location = res.headers['location'] as string;
        expect(location).toMatch(/\/oauth\/consent/);
        expect(location).toContain('code_challenge=');
        expect(location).toContain('redirect_uri=');
        expect(location).toContain(encodeURIComponent('tasks:read'));
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

    it('POST /oauth/token exchanges code for tokens including refresh_token', async () => {
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
            payload: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier },
        });
        expect(tokenRes.statusCode).toBe(200);
        const body = JSON.parse(tokenRes.body);
        expect(body).toHaveProperty('access_token');
        expect(body).toHaveProperty('id_token');
        expect(body).toHaveProperty('refresh_token');
        expect(body.token_type).toBe('Bearer');
    });

    it('POST /oauth/token refresh_token grant rotates the token', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        });
        const code = new URL(authorizeRes.headers['location'] as string).searchParams.get('code')!;

        const first = JSON.parse(
            (await app.inject({
                method: 'POST',
                url: '/oauth/token',
                payload: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier },
            })).body,
        );

        const refreshRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: { grant_type: 'refresh_token', refresh_token: first.refresh_token },
        });
        expect(refreshRes.statusCode).toBe(200);
        const second = JSON.parse(refreshRes.body);
        expect(second).toHaveProperty('access_token');
        expect(second).toHaveProperty('refresh_token');
        expect(second.refresh_token).not.toBe(first.refresh_token);

        // Old token must be consumed
        const replayRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: { grant_type: 'refresh_token', refresh_token: first.refresh_token },
        });
        expect(replayRes.statusCode).toBe(401);
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
            payload: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: 'wrong-verifier',
            },
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

    it('stores only selected scopes in the auth code', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:3001/callback';

        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&client_id=mcp&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=${encodeURIComponent('tasks:read tasks:write')}`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&selected_scopes=tasks%3Aread`,
        });
        expect(authorizeRes.statusCode).toBe(302);
        const location = authorizeRes.headers['location'] as string;
        const code = new URL(location).searchParams.get('code')!;

        const tokenRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: verifier,
            },
        });
        expect(tokenRes.statusCode).toBe(200);
        const token = JSON.parse(tokenRes.body) as { access_token: string; scope: string };
        expect(token.scope).toContain('tasks:read');
        expect(token.scope).not.toContain('tasks:write');
    });

    it('ignores selected scopes not in the original request', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:3001/callback';

        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&client_id=mcp&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=${encodeURIComponent('tasks:read')}`,
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            payload: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&selected_scopes=tasks%3Aread%20tasks%3Awrite`,
        });
        expect(authorizeRes.statusCode).toBe(302);
        const location = authorizeRes.headers['location'] as string;
        const code = new URL(location).searchParams.get('code')!;

        const tokenRes = await app.inject({
            method: 'POST',
            url: '/oauth/token',
            payload: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: verifier,
            },
        });
        expect(tokenRes.statusCode).toBe(200);
        const token = JSON.parse(tokenRes.body) as { scope: string };
        expect(token.scope).not.toContain('tasks:write');
    });

    describe('scope registry', () => {
        it('openid is required', () => {
            expect(SCOPE_REGISTRY['openid'].required).toBe(true);
        });

        it('filterScopes keeps only known scopes and always includes openid', () => {
            expect(filterScopes(['tasks:read', 'unknown:scope'])).toEqual(['openid', 'tasks:read']);
        });

        it('filterScopes includes openid even when not in requested list', () => {
            expect(filterScopes(['tasks:read'])).toEqual(['openid', 'tasks:read']);
        });

        it('groupScopesByResource groups by prefix', () => {
            const groups = groupScopesByResource(['tasks:read', 'tasks:write', 'notifications:read']);
            expect(groups).toEqual({
                tasks: [
                    { scope: 'tasks:read', label: 'Read tasks', required: false },
                    { scope: 'tasks:write', label: 'Create & manage tasks', required: false },
                ],
                notifications: [
                    { scope: 'notifications:read', label: 'Read notifications', required: false },
                ],
            });
        });
    });
});
