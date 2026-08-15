import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, type JWK, type KeyObject } from 'jose';
import { ACCESS_JWT_COOKIE, ACCESS_JWT_HEADER } from './access-identity.js';
import { AppModule } from '../app.module.js';

const ISSUER = 'https://ctm-test.cloudflareaccess.com';
const AUD = '0000000000000000000000000000000000000000000000000000000000000000';

let signing: { privateKey: KeyObject | CryptoKey; publicKey: KeyObject | CryptoKey };
let attacker: { privateKey: KeyObject | CryptoKey };
let publicJwk: JWK;

// Only the network call is stubbed. jwtVerify still does the real signature, issuer, audience and
// expiry checks against the key below, so these tests exercise the verifier rather than a mock.
vi.mock('jose', async (importOriginal) => {
    const actual = await importOriginal<typeof import('jose')>();

    return {
        ...actual,
        // Read lazily: the verifier builds its key set when Nest instantiates it, which is after
        // beforeAll has generated the keys.
        createRemoteJWKSet: (): unknown => actual.createLocalJWKSet({ keys: [publicJwk] }),
    };
});

describe('cloudflare access', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        signing = await generateKeyPair('RS256');
        attacker = await generateKeyPair('RS256');
        publicJwk = { ...(await exportJWK(signing.publicKey)), alg: 'RS256', kid: 'test-key' };

        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('rejects a request carrying no Access token', async () => {
        const response = await app.inject({ method: 'GET', url: '/auth/me' });

        expect(response.statusCode).toBe(401);
    });

    it('rejects a token signed by a key outside the team JWKS', async () => {
        const token = await sign({ key: attacker.privateKey });

        expect((await get({ token })).statusCode).toBe(401);
    });

    it('rejects a token minted for a different Access application', async () => {
        const token = await sign({ audience: 'some-other-application-audience-tag' });

        expect((await get({ token })).statusCode).toBe(401);
    });

    it('rejects a token from a different team', async () => {
        const token = await sign({ issuer: 'https://someone-else.cloudflareaccess.com' });

        expect((await get({ token })).statusCode).toBe(401);
    });

    it('rejects an expired token', async () => {
        const token = await sign({ expiresIn: '-1m' });

        expect((await get({ token })).statusCode).toBe(401);
    });

    it('rejects a token with no email claim', async () => {
        const token = await sign({ omitEmail: true });

        expect((await get({ token })).statusCode).toBe(401);
    });

    it('accepts a valid token and reports the operator', async () => {
        const response = await get({ token: await sign({}) });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ email: 'operator@example.com', subject: 'access-subject' });
    });

    it('accepts the token from the Access cookie when the header is absent', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/auth/me',
            cookies: { [ACCESS_JWT_COOKIE]: await sign({}) },
        });

        expect(response.statusCode).toBe(200);
    });

    it('gates the audit log behind the same check', async () => {
        expect((await app.inject({ method: 'GET', url: '/audit-log' })).statusCode).toBe(401);

        const allowed = await app.inject({
            method: 'GET',
            url: '/audit-log',
            headers: { [ACCESS_JWT_HEADER]: await sign({}) },
        });

        expect(allowed.statusCode).toBe(200);
    });

    function get({ token }: { token: string }) {
        return app.inject({ method: 'GET', url: '/auth/me', headers: { [ACCESS_JWT_HEADER]: token } });
    }
});

async function sign({
    key,
    issuer = ISSUER,
    audience = AUD,
    expiresIn = '5m',
    omitEmail = false,
}: {
    key?: KeyObject | CryptoKey;
    issuer?: string;
    audience?: string;
    expiresIn?: string;
    omitEmail?: boolean;
}): Promise<string> {
    const claims: Record<string, unknown> = { sub: 'access-subject' };

    if (!omitEmail) claims['email'] = 'operator@example.com';

    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience(audience)
        .setExpirationTime(expiresIn)
        .sign(key ?? signing.privateKey);
}
