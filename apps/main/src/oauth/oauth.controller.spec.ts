import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { OAuthClient, type OAuthClientDocument } from '../auth/schemas/oauth-client.schema.js';
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

    it('POST /oauth/authorize redirects with code for authenticated user', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const res = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid&state=xyz`,
            headers: { authorization: `Bearer ${jwt}` },
        });
        expect(res.statusCode).toBe(302);
        const location = res.headers['location'] as string;
        expect(location).toContain('code=');
        expect(location).toContain('state=xyz');
    });

    it('POST /oauth/authorize returns the location as JSON when the Accept header asks for it', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const res = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { authorization: `Bearer ${jwt}`, accept: 'application/json' },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).location).toContain('code=');
    });

    it('POST /oauth/authorize redirects when no Accept header is sent', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const res = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { authorization: `Bearer ${jwt}`, accept: '' },
        });

        expect(res.statusCode).toBe(302);
    });

    it('POST /oauth/authorize returns 401 without token', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const res = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
        });
        expect(res.statusCode).toBe(401);
    });

    it('POST /oauth/token exchanges code for tokens including refresh_token', async () => {
        const verifier = makeCodeVerifier();
        const challenge = makeCodeChallenge(verifier);
        const redirectUri = 'http://localhost:4000/cb';

        const authorizeRes = await app.inject({
            method: 'POST',
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
            headers: { authorization: `Bearer ${jwt}` },
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
            headers: { authorization: `Bearer ${jwt}` },
        });
        const code = new URL(authorizeRes.headers['location'] as string).searchParams.get('code')!;

        const first = JSON.parse(
            (
                await app.inject({
                    method: 'POST',
                    url: '/oauth/token',
                    payload: {
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri,
                        code_verifier: verifier,
                    },
                })
            ).body,
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
            headers: { authorization: `Bearer ${jwt}` },
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
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=${encodeURIComponent('tasks:read tasks:write')}`,
            headers: { authorization: `Bearer ${jwt}` },
            payload: { selected_scopes: 'tasks:read' },
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
            url: `/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=${encodeURIComponent('tasks:read')}`,
            headers: { authorization: `Bearer ${jwt}` },
            payload: { selected_scopes: 'tasks:read tasks:write' },
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

    describe('client registration + loopback redirect', () => {
        it('registers a client and allows loopback redirect_uri with any port', async () => {
            const regRes = await app.inject({
                method: 'POST',
                url: '/.well-known/oauth-client',
                payload: {
                    client_name: 'CTM CLI Test',
                    redirect_uris: ['http://127.0.0.1'],
                },
            });
            expect(regRes.statusCode).toBe(201);
            const client = JSON.parse(regRes.body) as { client_id: string };
            expect(client.client_id).toBeTruthy();

            const verifier = makeCodeVerifier();
            const challenge = makeCodeChallenge(verifier);
            const redirectUri = 'http://127.0.0.1:54321/callback';

            const authorizeRes = await app.inject({
                method: 'POST',
                url: `/oauth/authorize?response_type=code&client_id=${client.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
                headers: { authorization: `Bearer ${jwt}` },
            });
            expect(authorizeRes.statusCode).toBe(302);
            const code = new URL(authorizeRes.headers['location'] as string).searchParams.get('code')!;

            const tokenRes = await app.inject({
                method: 'POST',
                url: '/oauth/token',
                payload: { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier },
            });
            expect(tokenRes.statusCode).toBe(200);
            const tokens = JSON.parse(tokenRes.body);
            expect(tokens).toHaveProperty('access_token');
            expect(tokens).toHaveProperty('refresh_token');
        });

        it('rejects authorize when client_id is provided but redirect_uri is not permitted', async () => {
            const regRes = await app.inject({
                method: 'POST',
                url: '/.well-known/oauth-client',
                payload: {
                    client_name: 'CTM CLI Test Strict',
                    redirect_uris: ['http://127.0.0.1'],
                },
            });
            const client = JSON.parse(regRes.body) as { client_id: string };

            const verifier = makeCodeVerifier();
            const challenge = makeCodeChallenge(verifier);

            const authorizeRes = await app.inject({
                method: 'POST',
                url: `/oauth/authorize?response_type=code&client_id=${client.client_id}&redirect_uri=${encodeURIComponent('https://evil.com/steal')}&code_challenge=${challenge}&code_challenge_method=S256&scope=openid`,
                headers: { authorization: `Bearer ${jwt}` },
            });
            expect(authorizeRes.statusCode).toBe(400);
        });
    });

    describe('GET /oauth/client-info', () => {
        async function registerClient(redirectUris: string[]): Promise<string> {
            const res = await app.inject({
                method: 'POST',
                url: '/.well-known/oauth-client',
                payload: { client_name: 'Google Tasks (Official)', redirect_uris: redirectUris },
            });

            return (JSON.parse(res.body) as { client_id: string }).client_id;
        }

        it('reports a dynamically registered client as unverified, with its redirect hosts', async () => {
            const clientId = await registerClient([
                'https://impostor.example.com/cb',
                'https://impostor.example.com/cb2',
            ]);

            const res = await app.inject({
                method: 'GET',
                url: `/oauth/client-info?client_id=${clientId}`,
                headers: { authorization: `Bearer ${jwt}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body)).toEqual({
                clientId,
                clientName: 'Google Tasks (Official)',
                isDynamic: true,
                redirectHosts: ['impostor.example.com'],
            });
        });

        it('reports an operator-configured client as verified', async () => {
            const clientId = await registerClient(['https://mcp.example.com/cb']);
            const model = app.get<Model<OAuthClientDocument>>(getModelToken(OAuthClient.name));
            await model.updateOne({ clientId }, { $set: { isDynamic: false } });

            const res = await app.inject({
                method: 'GET',
                url: `/oauth/client-info?client_id=${clientId}`,
                headers: { authorization: `Bearer ${jwt}` },
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).isDynamic).toBe(false);
        });

        it('returns 404 for a client_id that was never registered', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/oauth/client-info?client_id=client_nonexistent',
                headers: { authorization: `Bearer ${jwt}` },
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 when client_id is missing', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/oauth/client-info',
                headers: { authorization: `Bearer ${jwt}` },
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 401 without a token', async () => {
            const res = await app.inject({ method: 'GET', url: '/oauth/client-info?client_id=client_anything' });

            expect(res.statusCode).toBe(401);
        });
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
                notifications: [{ scope: 'notifications:read', label: 'Read notifications', required: false }],
            });
        });
    });
});
