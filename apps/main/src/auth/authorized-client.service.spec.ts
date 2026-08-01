import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthorizedClientService } from './authorized-client.service.js';
import {
    AuthorizedClient,
    AuthorizedClientSchema,
    type AuthorizedClientDocument,
} from './schemas/authorized-client.schema.js';

describe('AuthorizedClientService', () => {
    let module: TestingModule;
    let service: AuthorizedClientService;
    let authorizedClientModel: Model<AuthorizedClientDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: AuthorizedClient.name, schema: AuthorizedClientSchema }]),
            ],
            providers: [AuthorizedClientService],
        }).compile();

        service = module.get(AuthorizedClientService);
        authorizedClientModel = module.get(`${AuthorizedClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    it('recordAuthorization creates a grant', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_grant_${Date.now()}`;

        await service.recordAuthorization({ userId, clientId, scopes: ['openid', 'tasks:read'], isDynamic: true });

        const grant = await authorizedClientModel.findOne({ userId, clientId });

        expect(grant).not.toBeNull();
        expect(grant!.scopes).toEqual(['openid', 'tasks:read']);
        expect(grant!.isDynamic).toBe(true);
        expect(grant!.authorizedAt).toBeInstanceOf(Date);
    });

    it('recordAuthorization is idempotent and updates scopes without moving authorizedAt', async () => {
        const userId = new Types.ObjectId().toHexString();
        const clientId = `client_idem_${Date.now()}`;

        await service.recordAuthorization({ userId, clientId, scopes: ['openid'], isDynamic: true });

        const first = await authorizedClientModel.findOne({ userId, clientId });

        await service.recordAuthorization({
            userId,
            clientId,
            scopes: ['openid', 'tasks:write'],
            isDynamic: true,
        });

        const grants = await authorizedClientModel.find({ userId, clientId });

        expect(grants).toHaveLength(1);
        expect(grants[0]!.scopes).toEqual(['openid', 'tasks:write']);
        expect(grants[0]!.authorizedAt.getTime()).toBe(first!.authorizedAt.getTime());
    });

    it('recordAuthorization keeps grants for different users separate', async () => {
        const userId1 = new Types.ObjectId().toHexString();
        const userId2 = new Types.ObjectId().toHexString();
        const clientId = `client_multiuser_${Date.now()}`;

        await service.recordAuthorization({ userId: userId1, clientId, scopes: ['openid'], isDynamic: false });
        await service.recordAuthorization({ userId: userId2, clientId, scopes: ['openid'], isDynamic: false });

        const grants = await authorizedClientModel.find({ clientId });

        expect(grants).toHaveLength(2);
    });

    it('findByUser returns only that user grants, newest first', async () => {
        const userId = new Types.ObjectId().toHexString();
        const older = `client_older_${Date.now()}`;
        const newer = `client_newer_${Date.now()}`;

        await authorizedClientModel.create({
            userId,
            clientId: older,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(Date.now() - 86400_000),
        });

        await authorizedClientModel.create({
            userId,
            clientId: newer,
            scopes: ['openid'],
            isDynamic: true,
            authorizedAt: new Date(),
        });

        await service.recordAuthorization({
            userId: new Types.ObjectId().toHexString(),
            clientId: `client_other_${Date.now()}`,
            scopes: ['openid'],
            isDynamic: true,
        });

        const grants = await service.findByUser(userId);

        expect(grants.map((grant) => grant.clientId)).toEqual([newer, older]);
    });
});
