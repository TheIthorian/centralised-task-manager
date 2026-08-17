import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import sharp from 'sharp';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OAuthClient, OAuthClientSchema, type OAuthClientDocument } from '@ctm/db';
import { AssetFetcher, AssetRejection, type FetchAssetResult } from '@ctm/server-utility';
import { ClientLogoService } from './client-logo.service.js';
import { LOGO_CONTENT_TYPE, LOGO_SIZE_PX } from './logo-image.js';

describe('ClientLogoService', () => {
    let module: TestingModule;
    let model: Model<OAuthClientDocument>;
    let result: FetchAssetResult;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: OAuthClient.name, schema: OAuthClientSchema }]),
            ],
            providers: [
                ClientLogoService,
                {
                    provide: AssetFetcher,
                    useFactory: (): AssetFetcher =>
                        ({ fetchAsset: async (): Promise<FetchAssetResult> => result }) as AssetFetcher,
                },
            ],
        }).compile();

        model = module.get(`${OAuthClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    it('stores the re-encoded image the fetcher returned', async () => {
        const service = module.get(ClientLogoService);
        const clientId = `client_logo_svc_${Date.now()}`;

        await model.create({ clientId, clientName: 'Logo App', redirectUris: ['https://example.com/cb'] });

        result = {
            ok: true,
            asset: {
                body: await sharp({ create: { width: 300, height: 300, channels: 3, background: '#336699' } })
                    .jpeg()
                    .toBuffer(),
                contentType: 'image/jpeg',
                finalUri: 'https://cdn.example.com/logo.jpg',
            },
        };

        await service.storeLogo({ clientId, logoUri: 'https://cdn.example.com/logo.jpg' });

        const logo = await service.getLogo({ clientId });

        expect(logo?.contentType).toBe(LOGO_CONTENT_TYPE);

        const metadata = await sharp(logo?.data).metadata();

        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(LOGO_SIZE_PX);
    });

    it('leaves the client without a logo when the fetch was refused', async () => {
        const service = module.get(ClientLogoService);
        const clientId = `client_nologo_svc_${Date.now()}`;

        await model.create({ clientId, clientName: 'No Logo App', redirectUris: ['https://example.com/cb'] });

        result = { ok: false, rejection: AssetRejection.HostNotAllowed };

        await service.storeLogo({ clientId, logoUri: 'https://internal.example.com/logo.png' });

        expect(await service.getLogo({ clientId })).toBeNull();
    });

    it('leaves the client without a logo when the bytes are not an image', async () => {
        const service = module.get(ClientLogoService);
        const clientId = `client_badlogo_svc_${Date.now()}`;

        await model.create({ clientId, clientName: 'Bad Logo App', redirectUris: ['https://example.com/cb'] });

        result = {
            ok: true,
            asset: {
                body: Buffer.from('<svg onload="alert(1)" />'),
                contentType: 'image/png',
                finalUri: 'https://cdn.example.com/logo.png',
            },
        };

        await service.storeLogo({ clientId, logoUri: 'https://cdn.example.com/logo.png' });

        expect(await service.getLogo({ clientId })).toBeNull();
    });
});
