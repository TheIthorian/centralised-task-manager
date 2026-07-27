import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { QuotaExceededError } from '@ctm/errors';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorsService } from './connectors.service.js';
import {
    ConnectorConfig,
    ConnectorConfigSchema,
    type ConnectorConfigDocument,
} from './schemas/connector-config.schema.js';
import { EncryptionService } from './encryption.service.js';
import { JwtService } from '@nestjs/jwt';
import { OAuthConnectorRegistry, ConnectorName } from '@ctm/connectors';
import type { OAuthTokens } from '@ctm/connectors';

const freshTokens: OAuthTokens = {
    accessToken: 'fresh-access',
    refreshToken: 'fresh-refresh',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

function makeService(configOverrides: Record<string, unknown> = {}) {
    const config = {
        accessToken: 'enc-access',
        refreshToken: 'enc-refresh',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        ...configOverrides,
    };

    const mockConnector = { refreshToken: vi.fn().mockResolvedValue(freshTokens) };
    const mockModel = {
        findOne: vi.fn().mockResolvedValue(config),
        findOneAndUpdate: vi.fn().mockResolvedValue(null),
        findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    };
    const mockEncryption = {
        decrypt: vi.fn((v: string) => `decrypted-${v}`),
        encrypt: vi.fn((v: string) => `encrypted-${v}`),
    };
    const mockRegistry = { get: vi.fn().mockReturnValue(mockConnector) };
    const mockJwt = { sign: vi.fn(), verify: vi.fn() };
    const mockConfig = { getOrThrow: vi.fn(() => 5) };

    const service = new ConnectorsService(
        mockModel as any,
        mockRegistry as any,
        mockEncryption as any,
        mockJwt as any,
        mockConfig as any,
    );

    return { service, mockModel, mockConnector, mockEncryption };
}

describe('ConnectorsService.ensureFreshTokens', () => {
    it('returns decrypted tokens without refresh when expiry is > 5 minutes away', async () => {
        const { service, mockConnector } = makeService({
            tokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
        });

        const result = await service.ensureFreshTokens({
            userId: new Types.ObjectId().toString(),
            connectionId: new Types.ObjectId().toString(),
        });

        expect(mockConnector.refreshToken).not.toHaveBeenCalled();
        expect(result.accessToken).toBe('decrypted-enc-access');
        expect(result.refreshToken).toBe('decrypted-enc-refresh');
    });

    it('calls refreshToken and persists when expiry is within 5 minutes', async () => {
        const { service, mockConnector, mockModel, mockEncryption } = makeService({
            tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 min from now
        });

        const result = await service.ensureFreshTokens({
            userId: new Types.ObjectId().toString(),
            connectionId: new Types.ObjectId().toString(),
        });

        expect(mockConnector.refreshToken).toHaveBeenCalled();
        expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                accessToken: `encrypted-${freshTokens.accessToken}`,
                refreshToken: `encrypted-${freshTokens.refreshToken}`,
                tokenExpiresAt: freshTokens.expiresAt,
            }),
        );
        expect(result.accessToken).toBe(freshTokens.accessToken);
    });

    it('throws NotFoundException when no config found', async () => {
        const { service, mockModel } = makeService();
        mockModel.findOne.mockResolvedValue(null);

        await expect(
            service.ensureFreshTokens({
                userId: new Types.ObjectId().toString(),
                connectionId: new Types.ObjectId().toString(),
            }),
        ).rejects.toThrow(NotFoundException);
    });
});

describe('ConnectorsService connections (real DB)', () => {
    let service: ConnectorsService;
    let model: Model<ConnectorConfigDocument>;
    let externalAccountId = 'ext-1';

    const mockConnector = {
        exchangeCode: vi.fn(async () => ({
            accessToken: 'a',
            refreshToken: 'r',
            expiresAt: new Date(Date.now() + 3_600_000),
        })),
        resolveAccountIdentity: vi.fn(async () => ({ externalAccountId, email: 'e@x.com' })),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: ConnectorConfig.name, schema: ConnectorConfigSchema }]),
            ],
            providers: [
                ConnectorsService,
                { provide: OAuthConnectorRegistry, useValue: { get: () => mockConnector } },
                { provide: EncryptionService, useValue: { encrypt: (v: string) => v, decrypt: (v: string) => v } },
                { provide: JwtService, useValue: {} },
            ],
        }).compile();

        service = moduleRef.get(ConnectorsService);
        model = moduleRef.get<Model<ConnectorConfigDocument>>(getModelToken(ConnectorConfig.name));
    });

    it('handleCallback dedups by externalAccountId (re-auth updates in place)', async () => {
        const userId = new Types.ObjectId().toString();
        const source = ConnectorName.GoogleTasks;
        externalAccountId = 'ext-1-' + Date.now();

        await service.handleCallback({ source, code: 'c1', userId });
        await service.handleCallback({ source, code: 'c2', userId });

        const rows = await service.listConnectionsForSource({ userId, source });
        expect(rows).toHaveLength(1);
        expect(rows[0]!.externalAccountId).toBe(externalAccountId);
    });

    it('listConnectionsForSource returns all accounts of a source', async () => {
        const userId = new Types.ObjectId().toString();
        const source = ConnectorName.GoogleTasks;
        const extA = 'ext-A-' + Date.now();
        const extB = 'ext-B-' + Date.now();

        externalAccountId = extA;
        await service.handleCallback({ source, code: 'c1', userId });
        externalAccountId = extB;
        await service.handleCallback({ source, code: 'c2', userId });

        const rows = await service.listConnectionsForSource({ userId, source });
        expect(rows.map((r) => r.externalAccountId).sort()).toEqual([extA, extB].sort());
    });

    it('caps the number of accounts per connector but still allows re-auth', async () => {
        const userId = new Types.ObjectId().toString();
        const source = ConnectorName.GoogleTasks;
        const max = Number(process.env['MAX_CONNECTIONS_PER_CONNECTOR']);
        const stamp = Date.now();

        for (let i = 0; i < max; i++) {
            externalAccountId = `ext-cap-${stamp}-${i}`;
            await service.handleCallback({ source, code: `c${i}`, userId });
        }

        externalAccountId = `ext-cap-${stamp}-overflow`;
        await expect(service.handleCallback({ source, code: 'overflow', userId })).rejects.toBeInstanceOf(
            QuotaExceededError,
        );

        externalAccountId = `ext-cap-${stamp}-0`;
        await expect(service.handleCallback({ source, code: 'reauth', userId })).resolves.toBeDefined();

        // The cap is per connector type, so a different source is unaffected.
        externalAccountId = `ext-cap-${stamp}-other`;
        await expect(
            service.handleCallback({ source: ConnectorName.Todoist, code: 'other', userId }),
        ).resolves.toBeDefined();
    });

    void model;
});
