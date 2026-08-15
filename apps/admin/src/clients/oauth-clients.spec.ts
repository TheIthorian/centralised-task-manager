import { Test } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Model } from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@ctm/errors';
import { OAuthClient, OAuthClientSchema, type OAuthClientDocument } from '@ctm/db';
import { OAuthClientsService } from './oauth-clients.service.js';

describe('OAuthClientsService', () => {
    const run = Date.now();
    const seededId = `seeded-${run}`;

    let service: OAuthClientsService;
    let model: Model<OAuthClientDocument>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, ignoreEnvVars: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: OAuthClient.name, schema: OAuthClientSchema }]),
            ],
            providers: [OAuthClientsService],
        }).compile();

        service = moduleRef.get(OAuthClientsService);
        model = moduleRef.get(getModelToken(OAuthClient.name));

        // Stands in for a client the boot-time seeding in apps/main owns.
        await model.create({
            clientId: seededId,
            clientName: 'Seeded CLI',
            redirectUris: ['http://127.0.0.1'],
            scopes: ['openid'],
            isDynamic: false,
            issuedAt: new Date(),
        });
    });

    describe('create', () => {
        it('registers a client and generates its id', async () => {
            const client = await create();

            expect(client.clientId).toMatch(/^ctm-[0-9a-f]{32}$/);
            expect(client.clientName).toBe(`Admin created ${run}`);
            expect(client.isDynamic).toBe(true);
        });

        it('defaults the grant and response types', async () => {
            const client = await create();

            expect(client.grantTypes).toEqual(['authorization_code', 'refresh_token']);
            expect(client.responseTypes).toEqual(['code']);
        });

        it('rejects a scope outside the registry', async () => {
            await expect(create({ scopes: ['openid', 'tasks:destroy'] })).rejects.toThrow(ValidationError);
        });
    });

    describe('update', () => {
        it('changes the fields it is given and leaves the rest alone', async () => {
            const client = await create();

            const updated = await service.update({
                clientId: client.clientId,
                dto: { clientName: 'Renamed' },
            });

            expect(updated.clientName).toBe('Renamed');
            expect(updated.redirectUris).toEqual(client.redirectUris);
        });

        it('clears a display field given an explicit null', async () => {
            const client = await create({ clientUri: 'https://example.com' });

            const updated = await service.update({ clientId: client.clientId, dto: { clientUri: null } });

            expect(updated.clientUri).toBeNull();
        });

        it('rejects a scope outside the registry', async () => {
            const client = await create();

            await expect(
                service.update({ clientId: client.clientId, dto: { scopes: ['nope'] } }),
            ).rejects.toThrow(ValidationError);
        });

        it('refuses to change a client seeded from code', async () => {
            await expect(service.update({ clientId: seededId, dto: { clientName: 'Hijacked' } })).rejects.toThrow(
                ConflictError,
            );
        });

        it('leaves the seeded client untouched after a refused write', async () => {
            const before = await service.findOne(seededId);

            await service.update({ clientId: seededId, dto: { clientName: 'Hijacked' } }).catch(() => undefined);

            expect(await service.findOne(seededId)).toEqual(before);
        });

        it('throws NotFound for an unknown client', async () => {
            await expect(service.update({ clientId: 'no-such-client', dto: { clientName: 'x' } })).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe('revoke', () => {
        it('removes the client', async () => {
            const client = await create();

            await service.revoke(client.clientId);

            await expect(service.findOne(client.clientId)).rejects.toThrow(NotFoundError);
        });

        it('refuses to remove a client seeded from code', async () => {
            await expect(service.revoke(seededId)).rejects.toThrow(ConflictError);
            expect(await service.findOne(seededId)).toBeDefined();
        });
    });

    describe('list', () => {
        it('finds a client by a fragment of its name', async () => {
            const client = await create();

            const { clients } = await service.list({ limit: 50, skip: 0, search: client.clientName });

            expect(clients.map((entry) => entry.clientId)).toContain(client.clientId);
        });

        it('separates code-seeded clients from dynamic ones', async () => {
            const { clients } = await service.list({ limit: 200, skip: 0, isDynamic: false });

            expect(clients.every((entry) => entry.isDynamic === false)).toBe(true);
            expect(clients.map((entry) => entry.clientId)).toContain(seededId);
        });

        it('treats a regex metacharacter in search as a literal', async () => {
            const { clients } = await service.list({ limit: 50, skip: 0, search: '.*' });

            expect(clients).toEqual([]);
        });
    });

    function create(overrides: Partial<Parameters<OAuthClientsService['create']>[0]> = {}) {
        return service.create({
            clientName: `Admin created ${run}`,
            redirectUris: ['https://example.com/callback'],
            scopes: ['openid', 'tasks:read'],
            ...overrides,
        });
    }
});
