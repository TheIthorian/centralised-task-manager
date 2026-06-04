import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthorizedAppsService } from './authorized-apps.service.js';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema.js';
import { OAuthClient, OAuthClientSchema } from './schemas/oauth-client.schema.js';

describe('AuthorizedAppsService', () => {
    let module: TestingModule;
    let service: AuthorizedAppsService;
    let refreshTokenModel: Model<typeof RefreshToken>;
    let oauthClientModel: Model<typeof OAuthClient>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: RefreshToken.name, schema: RefreshTokenSchema },
                    { name: OAuthClient.name, schema: OAuthClientSchema },
                ]),
            ],
            providers: [AuthorizedAppsService],
        }).compile();

        service = module.get(AuthorizedAppsService);
        refreshTokenModel = module.get(`${RefreshToken.name}Model`);
        oauthClientModel = module.get(`${OAuthClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    it('getAuthorizedApps returns OAuth apps for user with active tokens', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientSecretHash: 'hash',
            clientName: 'Test App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await refreshTokenModel.create({
            tokenHash: `hash_${Date.now()}`,
            userId,
            clientId,
            scopes: ['openid', 'tasks:read'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        const result = await service.getAuthorizedApps(userId);
        const oauthResult = result.filter((a) => a.type === 'oauth');

        expect(oauthResult).toHaveLength(1);
        expect(oauthResult[0]!.clientId).toBe(clientId);
        expect(oauthResult[0]!.clientName).toBe('Test App');
        expect(oauthResult[0]!.scopes).toEqual(['openid', 'tasks:read']);
        expect(oauthResult[0]!.authorizedAt).toBeDefined();
        expect(oauthResult[0]!.type).toBe('oauth');
    });

    it('getAuthorizedApps ignores OAuth tokens with no clientId', async () => {
        const userId = new Types.ObjectId().toHexString();

        await refreshTokenModel.create({
            tokenHash: `hash_noclient_${Date.now()}`,
            userId,
            scopes: [],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result.filter((a) => a.type === 'oauth')).toHaveLength(0);
    });

    it('getAuthorizedApps deduplicates multiple tokens for same client', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_dedup_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientSecretHash: 'hash',
            clientName: 'Dedup App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await refreshTokenModel.create({
            tokenHash: `hash_a_${Date.now()}`,
            userId,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await refreshTokenModel.create({
            tokenHash: `hash_b_${Date.now() + 1}`,
            userId,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result.filter((a) => a.clientId === clientId)).toHaveLength(1);
    });

    it('revokeAuthorizedApp dynamic: deletes client and all refresh tokens', async () => {
        const userId1 = new Types.ObjectId().toHexString();
        const userId2 = new Types.ObjectId().toHexString();
        const clientId = `client_dyn_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientSecretHash: 'hash',
            clientName: 'Dynamic App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await refreshTokenModel.create({
            tokenHash: `hash_u1_${Date.now()}`,
            userId: userId1,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await refreshTokenModel.create({
            tokenHash: `hash_u2_${Date.now()}`,
            userId: userId2,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await service.revokeAuthorizedApp({ userId: userId1, clientId });

        const clientAfter = await oauthClientModel.findOne({ clientId });
        const tokensAfter = await refreshTokenModel.find({ clientId });

        expect(clientAfter).toBeNull();
        expect(tokensAfter).toHaveLength(0);
    });

    it('revokeAuthorizedApp static: deletes only the requesting user token', async () => {
        const userId1 = new Types.ObjectId().toHexString();
        const userId2 = new Types.ObjectId().toHexString();
        const clientId = `client_static_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientSecretHash: 'hash',
            clientName: 'Static App',
            redirectUris: ['http://localhost'],
            isDynamic: false,
        });

        await refreshTokenModel.create({
            tokenHash: `hash_s1_${Date.now()}`,
            userId: userId1,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await refreshTokenModel.create({
            tokenHash: `hash_s2_${Date.now()}`,
            userId: userId2,
            clientId,
            scopes: ['openid'],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        await service.revokeAuthorizedApp({ userId: userId1, clientId });

        const clientAfter = await oauthClientModel.findOne({ clientId });
        const user1Tokens = await refreshTokenModel.find({ userId: userId1, clientId });
        const user2Tokens = await refreshTokenModel.find({ userId: userId2, clientId });

        expect(clientAfter).not.toBeNull();
        expect(user1Tokens).toHaveLength(0);
        expect(user2Tokens).toHaveLength(1);
    });

    it('revokeAuthorizedApp throws NotFoundException for unknown client', async () => {
        await expect(service.revokeAuthorizedApp({ userId: 'uid', clientId: 'client_nonexistent' })).rejects.toThrow(
            'Authorized app client_nonexistent not found',
        );
    });
});
