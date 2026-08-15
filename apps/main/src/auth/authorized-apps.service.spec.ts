import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NotFoundError } from '@ctm/errors';
import { AuthorizedAppsService } from './authorized-apps.service.js';
import {
    RefreshToken,
    RefreshTokenGrant,
    RefreshTokenSchema,
    type RefreshTokenDocument,
} from './schemas/refresh-token.schema.js';
import { OAuthClient, OAuthClientSchema, type OAuthClientDocument } from './schemas/oauth-client.schema.js';
import {
    AuthorizedClient,
    AuthorizedClientSchema,
    type AuthorizedClientDocument,
} from './schemas/authorized-client.schema.js';

describe('AuthorizedAppsService', () => {
    let module: TestingModule;
    let service: AuthorizedAppsService;
    let refreshTokenModel: Model<RefreshTokenDocument>;
    let oauthClientModel: Model<OAuthClientDocument>;
    let authorizedClientModel: Model<AuthorizedClientDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: RefreshToken.name, schema: RefreshTokenSchema },
                    { name: OAuthClient.name, schema: OAuthClientSchema },
                    { name: AuthorizedClient.name, schema: AuthorizedClientSchema },
                ]),
            ],
            providers: [AuthorizedAppsService],
        }).compile();

        service = module.get(AuthorizedAppsService);
        refreshTokenModel = module.get(`${RefreshToken.name}Model`);
        oauthClientModel = module.get(`${OAuthClient.name}Model`);
        authorizedClientModel = module.get(`${AuthorizedClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    it('getAuthorizedApps returns the apps a user has granted', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientName: 'Test App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await authorizedClientModel.create({
            userId,
            clientId,
            scopes: ['openid', 'tasks:read'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result).toHaveLength(1);
        expect(result[0]!.clientId).toBe(clientId);
        expect(result[0]!.clientName).toBe('Test App');
        expect(result[0]!.scopes).toEqual(['openid', 'tasks:read']);
        expect(result[0]!.authorizedAt).toBeDefined();
        expect(result[0]!.type).toBe('oauth');
    });

    it('getAuthorizedApps returns declared client metadata but never the logo', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_meta_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientName: 'Metadata App',
            redirectUris: ['https://example.com/cb'],
            isDynamic: true,
            logoUri: 'https://example.com/logo.png',
            clientUri: 'https://example.com',
            tosUri: 'https://example.com/tos',
            policyUri: 'https://example.com/privacy',
            contacts: ['ops@example.com'],
            softwareId: 'example-client',
        });

        await authorizedClientModel.create({
            userId,
            clientId,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        const [app] = await service.getAuthorizedApps(userId);

        expect(app!.clientUri).toBe('https://example.com');
        expect(app!.tosUri).toBe('https://example.com/tos');
        expect(app!.policyUri).toBe('https://example.com/privacy');
        expect(app!.contacts).toEqual(['ops@example.com']);
        expect(app!.softwareId).toBe('example-client');
        expect(JSON.stringify(app)).not.toContain('logo.png');
    });

    it('getAuthorizedApps ignores refresh tokens with no clientId', async () => {
        const userId = new Types.ObjectId().toHexString();

        await refreshTokenModel.create({
            tokenHash: `hash_noclient_${Date.now()}`,
            grant: RefreshTokenGrant.Session,
            userId,
            scopes: [],
            expiresAt: new Date(Date.now() + 86400_000),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result).toHaveLength(0);
    });

    it('getAuthorizedApps returns one entry per client however many tokens exist', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_dedup_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientName: 'Dedup App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await authorizedClientModel.create({
            userId,
            clientId,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        for (const suffix of ['a', 'b']) {
            await refreshTokenModel.create({
                tokenHash: `hash_${suffix}_${Date.now()}`,
                grant: RefreshTokenGrant.OAuth,
                userId,
                clientId,
                scopes: ['openid'],
                expiresAt: new Date(Date.now() + 86400_000),
            });
        }

        const result = await service.getAuthorizedApps(userId);

        expect(result.filter((app) => app.clientId === clientId)).toHaveLength(1);
    });

    it('getAuthorizedApps lists a grant that has no refresh token left', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_notoken_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientSecretHash: 'hash',
            clientName: 'Token-less App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        await authorizedClientModel.create({
            userId,
            clientId,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result.map((app) => app.clientId)).toEqual([clientId]);
    });

    it('getAuthorizedApps skips grants whose client no longer exists', async () => {
        const userId = new Types.ObjectId().toHexString();

        await authorizedClientModel.create({
            userId,
            clientId: `client_reaped_${Date.now()}`,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        const result = await service.getAuthorizedApps(userId);

        expect(result).toHaveLength(0);
    });

    it('getAuthorizedApps returns nothing for a user with no grants', async () => {
        const result = await service.getAuthorizedApps(new Types.ObjectId().toHexString());

        expect(result).toHaveLength(0);
    });

    it('revokeAuthorizedApp dynamic: deletes client, all grants and all refresh tokens', async () => {
        const userId1 = new Types.ObjectId().toHexString();
        const userId2 = new Types.ObjectId().toHexString();
        const clientId = `client_dyn_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientName: 'Dynamic App',
            redirectUris: ['http://localhost'],
            isDynamic: true,
        });

        for (const userId of [userId1, userId2]) {
            await authorizedClientModel.create({
                userId,
                clientId,
                scopes: ['openid'],
                isDynamic: true,
                authorizedAt: new Date(),
            });

            await refreshTokenModel.create({
                tokenHash: `hash_${userId}_${Date.now()}`,
                grant: RefreshTokenGrant.OAuth,
                userId,
                clientId,
                scopes: ['openid'],
                expiresAt: new Date(Date.now() + 86400_000),
            });
        }

        await service.revokeAuthorizedApp({ userId: userId1, clientId });

        expect(await oauthClientModel.findOne({ clientId })).toBeNull();
        expect(await authorizedClientModel.find({ clientId })).toHaveLength(0);
        expect(await refreshTokenModel.find({ clientId })).toHaveLength(0);
    });

    it('revokeAuthorizedApp static: deletes only the requesting user grant and tokens', async () => {
        const userId1 = new Types.ObjectId().toHexString();
        const userId2 = new Types.ObjectId().toHexString();
        const clientId = `client_static_${Date.now()}`;

        await oauthClientModel.create({
            clientId,
            clientName: 'Static App',
            redirectUris: ['http://localhost'],
            isDynamic: false,
        });

        for (const userId of [userId1, userId2]) {
            await authorizedClientModel.create({
                userId,
                clientId,
                scopes: ['openid'],
                isDynamic: false,
                authorizedAt: new Date(),
            });

            await refreshTokenModel.create({
                tokenHash: `hash_s_${userId}_${Date.now()}`,
                grant: RefreshTokenGrant.OAuth,
                userId,
                clientId,
                scopes: ['openid'],
                expiresAt: new Date(Date.now() + 86400_000),
            });
        }

        await service.revokeAuthorizedApp({ userId: userId1, clientId });

        expect(await oauthClientModel.findOne({ clientId })).not.toBeNull();
        expect(await authorizedClientModel.find({ userId: userId1, clientId })).toHaveLength(0);
        expect(await refreshTokenModel.find({ userId: userId1, clientId })).toHaveLength(0);
        expect(await authorizedClientModel.find({ userId: userId2, clientId })).toHaveLength(1);
        expect(await refreshTokenModel.find({ userId: userId2, clientId })).toHaveLength(1);
    });

    it('revokeAuthorizedApp falls back to the grant when the client was reaped', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_orphan_${Date.now()}`;

        await authorizedClientModel.create({
            userId,
            clientId,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        await service.revokeAuthorizedApp({ userId, clientId });

        expect(await authorizedClientModel.find({ userId, clientId })).toHaveLength(0);
    });

    it('revokeAuthorizedApp throws NotFoundError for unknown client', async () => {
        await expect(service.revokeAuthorizedApp({ userId: 'uid', clientId: 'client_nonexistent' })).rejects.toThrow(
            NotFoundError,
        );
    });
});
