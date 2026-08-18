import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isRedirectUriPermitted, OAuthClientService, UNUSED_CLIENT_TTL_DAYS } from './oauth-client.service.js';
import { OAuthClient, OAuthClientSchema, type OAuthClientDocument } from '@ctm/db';
import { AssetFetcher } from '@ctm/server-utility';
import { ClientLogoService } from './client-logo.service.js';
import { ClientIdMetadataService } from './client-id-metadata.service.js';
import { ConfigService } from '@nestjs/config';
import { ClientTrustService } from './client-trust.service.js';

describe('isRedirectUriPermitted', () => {
    it('exact-matches non-loopback URIs', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://example.com/callback')).toBe(true);
    });

    it('rejects non-loopback URI not in registered list', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://other.com/callback')).toBe(false);
    });

    it('rejects non-loopback URIs that differ only in port', () => {
        expect(isRedirectUriPermitted(['https://example.com/callback'], 'https://example.com:8080/callback')).toBe(
            false,
        );
    });

    it('allows loopback 127.0.0.1 with any port', () => {
        expect(isRedirectUriPermitted(['http://127.0.0.1'], 'http://127.0.0.1:52345/callback')).toBe(true);
    });

    it('allows loopback localhost with any port', () => {
        expect(isRedirectUriPermitted(['http://localhost'], 'http://localhost:12345/callback')).toBe(true);
    });

    it('allows loopback ::1 with any port', () => {
        expect(isRedirectUriPermitted(['http://[::1]'], 'http://[::1]:9999/callback')).toBe(true);
    });

    it('rejects loopback URI with mismatched scheme', () => {
        expect(isRedirectUriPermitted(['http://127.0.0.1'], 'https://127.0.0.1:52345/callback')).toBe(false);
    });

    it('returns true if any registered URI matches', () => {
        expect(
            isRedirectUriPermitted(
                ['https://example.com/callback', 'http://127.0.0.1'],
                'http://127.0.0.1:9876/callback',
            ),
        ).toBe(true);
    });

    it('allows a native app private-use scheme registered exactly', () => {
        expect(
            isRedirectUriPermitted(
                ['cursor://anysphere.cursor-mcp/oauth/callback'],
                'cursor://anysphere.cursor-mcp/oauth/callback',
            ),
        ).toBe(true);
    });

    it('rejects a private-use scheme URI whose path differs from the registered one', () => {
        expect(isRedirectUriPermitted(['com.example.app:/oauth'], 'com.example.app:/stolen')).toBe(false);
        expect(
            isRedirectUriPermitted(
                ['cursor://anysphere.cursor-mcp/oauth/callback'],
                'cursor://anysphere.cursor-mcp/evil',
            ),
        ).toBe(false);
    });

    it('returns false for empty registered list', () => {
        expect(isRedirectUriPermitted([], 'http://127.0.0.1:1234/callback')).toBe(false);
    });
});

describe('OAuthClientService unused-client reaping', () => {
    let module: TestingModule;
    let service: OAuthClientService;
    let model: Model<OAuthClientDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: OAuthClient.name, schema: OAuthClientSchema }]),
            ],
            providers: [
                OAuthClientService,
                ClientLogoService,
                ClientIdMetadataService,
                ClientTrustService,
                { provide: ConfigService, useValue: { getOrThrow: (): string => '' } },
                { provide: AssetFetcher, useFactory: (): AssetFetcher => new AssetFetcher() },
            ],
        }).compile();

        service = module.get(OAuthClientService);
        model = module.get(`${OAuthClient.name}Model`);
    });

    afterAll(async () => {
        await module.close();
    });

    it('stamps a reaping deadline on a newly registered client', async () => {
        const registered = await service.register({
            client_name: `reap-${Date.now()}`,
            redirect_uris: ['https://example.com/cb'],
        });

        const doc = await model.findOne({ clientId: registered.client_id });
        const expectedMs = Date.now() + UNUSED_CLIENT_TTL_DAYS * 24 * 60 * 60 * 1000;

        expect(doc?.lastUsedAt).toBeUndefined();
        expect(doc?.unusedExpiresAt).toBeInstanceOf(Date);
        expect(Math.abs(doc!.unusedExpiresAt!.getTime() - expectedMs)).toBeLessThan(60_000);
    });

    it('clears the reaping deadline once the client is used', async () => {
        const registered = await service.register({
            client_name: `used-${Date.now()}`,
            redirect_uris: ['https://example.com/cb'],
        });

        await service.markUsed({ clientId: registered.client_id });

        const doc = await model.findOne({ clientId: registered.client_id });

        expect(doc?.unusedExpiresAt).toBeUndefined();
        expect(doc?.lastUsedAt).toBeInstanceOf(Date);
    });

    it('markUsed is idempotent', async () => {
        const registered = await service.register({
            client_name: `twice-${Date.now()}`,
            redirect_uris: ['https://example.com/cb'],
        });

        await service.markUsed({ clientId: registered.client_id });
        await service.markUsed({ clientId: registered.client_id });

        const doc = await model.findOne({ clientId: registered.client_id });

        expect(doc?.unusedExpiresAt).toBeUndefined();
        expect(doc?.lastUsedAt).toBeInstanceOf(Date);
    });

    it('echoes the registered client_name', async () => {
        const name = `named-${Date.now()}`;
        const registered = await service.register({ client_name: name, redirect_uris: ['https://example.com/cb'] });

        expect(registered.client_name).toBe(name);
    });
});
