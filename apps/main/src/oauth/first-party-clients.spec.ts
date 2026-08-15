import { Test } from '@nestjs/testing';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../app.module.js';
import {
    OAuthClient,
    type OAuthClientDocument,
    RefreshToken,
    type RefreshTokenDocument,
    RefreshTokenGrant,
} from '@ctm/db';
import { AuthorizedAppsService } from './authorized-apps.service.js';
import { FIRST_PARTY_CLIENT } from '../rate-limit/principal-resolver.js';
import { CLI_CLIENT_ID } from './first-party-clients.js';

describe('First-party OAuth clients', () => {
    let app: NestFastifyApplication;
    let clients: Model<OAuthClientDocument>;
    let refreshTokens: Model<RefreshTokenDocument>;
    let authorizedApps: AuthorizedAppsService;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        clients = app.get(getModelToken(OAuthClient.name));
        refreshTokens = app.get(getModelToken(RefreshToken.name));
        authorizedApps = app.get(AuthorizedAppsService);
    });

    afterAll(async () => {
        await app.close();
    });

    it('registers the CLI client on boot', async () => {
        const cli = await clients.findOne({ clientId: CLI_CLIENT_ID });

        expect(cli).not.toBeNull();
        expect(cli!.clientName).toBe('CTM CLI');
        expect(cli!.isDynamic).toBe(false);
    });

    it('exempts a first-party client from unused-client reaping', async () => {
        const cli = await clients.findOne({ clientId: CLI_CLIENT_ID });

        expect(cli!.unusedExpiresAt).toBeUndefined();
    });

    it('accepts the CLI loopback callback on any port', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/oauth/authorize?response_type=code&client_id=${CLI_CLIENT_ID}&redirect_uri=${encodeURIComponent('http://127.0.0.1:53124/callback')}&code_challenge=${'a'.repeat(43)}&code_challenge_method=S256&scope=openid`,
        });

        expect(res.statusCode).toBe(302);
    });

    it('does not expose session tokens to authorized-app revocation', async () => {
        const userId = `user_${Date.now()}`;

        await refreshTokens.create({
            tokenHash: `hash_session_${Date.now()}`,
            grant: RefreshTokenGrant.Session,
            clientId: FIRST_PARTY_CLIENT,
            userId,
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await expect(authorizedApps.revokeAuthorizedApp({ userId, clientId: FIRST_PARTY_CLIENT })).rejects.toThrow();

        expect(await refreshTokens.find({ userId, clientId: FIRST_PARTY_CLIENT })).toHaveLength(1);
    });
});
