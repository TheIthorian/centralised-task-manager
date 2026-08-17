import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { type NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import type { Model } from 'mongoose';
import sharp from 'sharp';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OAuthClient, type OAuthClientDocument } from '@ctm/db';
import { AppModule } from '../app.module.js';
import { LOGO_CONTENT_TYPE } from './logo-image.js';

describe('GET /oauth/clients/:clientId/logo', () => {
    let app: NestFastifyApplication;
    let model: Model<OAuthClientDocument>;
    let logo: Buffer;

    const clientId = `client_logo_${Date.now()}`;
    const clientIdWithoutLogo = `client_nologo_${Date.now()}`;

    beforeAll(async () => {
        const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = module.createNestApplication(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        model = app.get(getModelToken(OAuthClient.name));
        logo = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#123456' } })
            .png()
            .toBuffer();

        await model.create({
            clientId,
            clientName: 'With logo',
            redirectUris: ['https://example.com/callback'],
            logoUri: 'https://cdn.example.com/logo.png',
            logo: { data: logo, contentType: LOGO_CONTENT_TYPE, fetchedAt: new Date() },
        });

        await model.create({
            clientId: clientIdWithoutLogo,
            clientName: 'No logo',
            redirectUris: ['https://example.com/callback'],
        });
    });

    afterAll(async () => {
        await app.close();
    });

    it('serves the stored logo without authentication', async () => {
        const res = await app.inject({ method: 'GET', url: `/oauth/clients/${clientId}/logo` });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe(LOGO_CONTENT_TYPE);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
        expect(res.rawPayload.equals(logo)).toBe(true);
    });

    it('returns 404 for a client with no stored logo', async () => {
        const res = await app.inject({ method: 'GET', url: `/oauth/clients/${clientIdWithoutLogo}/logo` });

        expect(res.statusCode).toBe(404);
    });

    it('returns 404 for an unknown client', async () => {
        const res = await app.inject({ method: 'GET', url: '/oauth/clients/client_missing/logo' });

        expect(res.statusCode).toBe(404);
    });
});
