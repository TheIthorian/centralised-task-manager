import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { OAuthClient, OAuthClientRegistration, OAuthClientSchema, type OAuthClientDocument } from '@ctm/db';
import { AssetFetcher, AssetRejection, type FetchAssetResult } from '@ctm/server-utility';
import { ClientLogoService } from './client-logo.service.js';
import { ClientIdMetadataService, MAX_METADATA_TTL_MS, MIN_METADATA_TTL_MS } from './client-id-metadata.service.js';

describe('ClientIdMetadataService', () => {
    let module: TestingModule;
    let service: ClientIdMetadataService;
    let model: Model<OAuthClientDocument>;
    let result: FetchAssetResult;
    let requested: string[];

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: OAuthClient.name, schema: OAuthClientSchema }]),
            ],
            providers: [
                ClientIdMetadataService,
                ClientLogoService,
                {
                    provide: AssetFetcher,
                    useFactory: (): AssetFetcher =>
                        ({
                            fetchAsset: async ({ uri }: { uri: string }): Promise<FetchAssetResult> => {
                                requested.push(uri);

                                return result;
                            },
                        }) as AssetFetcher,
                },
            ],
        }).compile();

        service = module.get(ClientIdMetadataService);
        model = module.get(`${OAuthClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        requested = [];
    });

    it('caches a valid document as a client of its own registration type', async () => {
        const clientId = documentUrl();

        result = document({ clientId });

        const client = await service.resolve({ clientId });

        expect(client).toMatchObject({
            clientId,
            clientName: 'Metadata App',
            redirectUris: ['http://127.0.0.1/callback'],
            registrationType: OAuthClientRegistration.ClientIdMetadataDocument,
        });
        expect(await model.countDocuments({ clientId })).toBe(1);
    });

    it('serves a cached document without fetching it again', async () => {
        const clientId = documentUrl();

        result = document({ clientId });
        await service.resolve({ clientId });

        requested = [];
        await service.resolve({ clientId });

        expect(requested).toEqual([]);
    });

    it('keeps a document that declares grants this server does not implement', async () => {
        const clientId = documentUrl();

        result = jsonAsset({
            clientId,
            body: {
                client_id: clientId,
                client_name: 'Claude',
                client_uri: 'https://claude.ai',
                redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
                grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
                response_types: ['code'],
                token_endpoint_auth_method: 'none',
            },
        });

        expect(await service.resolve({ clientId })).toMatchObject({
            clientName: 'Claude',
            grantTypes: ['authorization_code', 'refresh_token'],
            responseTypes: ['code'],
        });
    });

    it('refuses a document that declares no grant type this server can honour', async () => {
        const clientId = documentUrl();

        result = jsonAsset({
            clientId,
            body: {
                client_id: clientId,
                client_name: 'Machine App',
                redirect_uris: ['https://app.example.com/cb'],
                grant_types: ['client_credentials'],
            },
        });

        expect(await service.resolve({ clientId })).toBeNull();
    });

    it('refuses a document whose client_id is not the URL it was fetched from', async () => {
        const clientId = documentUrl();

        result = document({ clientId: 'https://elsewhere.example.com/client.json' });

        expect(await service.resolve({ clientId })).toBeNull();
    });

    it('refuses a document that is not valid JSON', async () => {
        const clientId = documentUrl();

        result = {
            ok: true,
            asset: { body: Buffer.from('<html>'), contentType: 'application/json', finalUri: clientId, headers: {} },
        };

        expect(await service.resolve({ clientId })).toBeNull();
    });

    it('refuses a document missing the metadata every client must publish', async () => {
        const clientId = documentUrl();

        result = jsonAsset({ clientId, body: { client_id: clientId, client_name: 'No Redirects' } });

        expect(await service.resolve({ clientId })).toBeNull();
    });

    it('keeps serving the last good document when the client stops publishing one', async () => {
        const clientId = documentUrl();

        result = document({ clientId });
        await service.resolve({ clientId });
        await model.updateOne({ clientId }, { $set: { metadataExpiresAt: new Date(0) } });

        result = { ok: false, rejection: AssetRejection.Unreachable };

        expect(await service.resolve({ clientId })).toMatchObject({ clientId, clientName: 'Metadata App' });
    });

    it('clamps the cache lifetime the origin asks for', async () => {
        const clientId = documentUrl();

        result = document({ clientId, cacheControl: 'public, max-age=31536000' });

        const client = await service.resolve({ clientId });
        const ttlMs = (client?.metadataExpiresAt?.getTime() ?? 0) - Date.now();

        expect(ttlMs).toBeGreaterThan(MAX_METADATA_TTL_MS - MIN_METADATA_TTL_MS);
        expect(ttlMs).toBeLessThanOrEqual(MAX_METADATA_TTL_MS);
    });
});

function documentUrl(): string {
    return `https://app.example.com/${Date.now()}-${Math.random().toString(36).slice(2)}/client.json`;
}

function document({ clientId, cacheControl }: { clientId: string; cacheControl?: string }): FetchAssetResult {
    return jsonAsset({
        clientId,
        cacheControl,
        body: {
            client_id: clientId,
            client_name: 'Metadata App',
            redirect_uris: ['http://127.0.0.1/callback'],
            token_endpoint_auth_method: 'none',
        },
    });
}

function jsonAsset({
    clientId,
    body,
    cacheControl,
}: {
    clientId: string;
    body: Record<string, unknown>;
    cacheControl?: string;
}): FetchAssetResult {
    return {
        ok: true,
        asset: {
            body: Buffer.from(JSON.stringify(body)),
            contentType: 'application/json',
            finalUri: clientId,
            headers: cacheControl ? { 'cache-control': cacheControl } : {},
        },
    };
}
