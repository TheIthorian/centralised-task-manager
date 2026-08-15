import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { AuthService } from '../auth/auth.service.js';
import { OAuthService } from '../oauth/oauth.service.js';
import { UsersService } from '../users/users.service.js';
import { FIRST_PARTY_CLIENT } from '../rate-limit/principal-resolver.js';

describe('Both flows sign the same access-token claims', () => {
    let module: TestingModule;
    let auth: AuthService;
    let oauth: OAuthService;
    let users: UsersService;
    let jwt: JwtService;

    beforeAll(async () => {
        module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        auth = module.get(AuthService);
        oauth = module.get(OAuthService);
        users = module.get(UsersService);
        jwt = module.get(JwtService);
    });

    afterAll(async () => {
        await module.close();
    });

    const CLAIMS = ['sub', 'email', 'iss', 'aud', 'client_id'];

    it('a first-party login token carries every claim, attributed to the first-party client', async () => {
        const email = `claims-session-${Date.now()}@example.com`;
        const { accessToken } = await auth.register({ email, password: 'password123' });
        const payload = jwt.verify<Record<string, unknown>>(accessToken);

        expect(Object.keys(payload)).toEqual(expect.arrayContaining(CLAIMS));
        expect(payload['email']).toBe(email);
        expect(payload['client_id']).toBe(FIRST_PARTY_CLIENT);
    });

    it('an OAuth grant token carries the same claims, attributed to the requesting client', async () => {
        const email = `claims-oauth-${Date.now()}@example.com`;
        const user = await users.create({ email, password: 'password123' });
        const clientId = `client_${Date.now()}`;
        const { access_token } = await oauth.issueTokens({
            userId: String(user._id),
            email,
            scopes: ['openid'],
            clientId,
        });

        const payload = jwt.verify<Record<string, unknown>>(access_token);

        expect(Object.keys(payload)).toEqual(expect.arrayContaining(CLAIMS));
        expect(payload['email']).toBe(email);
        expect(payload['client_id']).toBe(clientId);
    });
});
