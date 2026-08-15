import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import { AuthService } from '../auth/auth.service.js';
import { OAuthService } from '../oauth/oauth.service.js';
import { UsersService } from '../users/users.service.js';

describe('Refresh tokens are fenced to the flow that issued them', () => {
    let module: TestingModule;
    let auth: AuthService;
    let oauth: OAuthService;
    let users: UsersService;

    beforeAll(async () => {
        module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        auth = module.get(AuthService);
        oauth = module.get(OAuthService);
        users = module.get(UsersService);
    });

    afterAll(async () => {
        await module.close();
    });

    async function issueOAuthRefreshToken(): Promise<string> {
        const email = `grant-oauth-${Date.now()}-${Math.random()}@example.com`;
        const user = await users.create({ email, password: 'password123' });
        const tokens = await oauth.issueTokens({
            userId: String(user._id),
            email,
            scopes: ['openid', 'email'],
            clientId: `client_${Date.now()}`,
        });

        return tokens.refresh_token;
    }

    async function issueSessionRefreshToken(): Promise<string> {
        const email = `grant-session-${Date.now()}-${Math.random()}@example.com`;
        const { refreshToken } = await auth.register({ email, password: 'password123' });

        return refreshToken;
    }

    it('rejects an OAuth refresh token at the first-party refresh endpoint', async () => {
        const refreshToken = await issueOAuthRefreshToken();

        await expect(auth.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a session refresh token at the OAuth token endpoint', async () => {
        const refreshToken = await issueSessionRefreshToken();

        await expect(oauth.refreshAccessToken({ refreshToken })).rejects.toThrow(UnauthorizedException);
    });

    it('leaves an OAuth refresh token usable after a rejected first-party refresh', async () => {
        const refreshToken = await issueOAuthRefreshToken();

        await expect(auth.refreshSession(refreshToken)).rejects.toThrow(UnauthorizedException);

        const tokens = await oauth.refreshAccessToken({ refreshToken });

        expect(tokens.scope).toBe('openid email');
    });

    it('leaves a session refresh token usable after a rejected OAuth refresh', async () => {
        const refreshToken = await issueSessionRefreshToken();

        await expect(oauth.refreshAccessToken({ refreshToken })).rejects.toThrow(UnauthorizedException);

        const pair = await auth.refreshSession(refreshToken);

        expect(pair.refreshToken).toMatch(/^rt_/);
    });
});
