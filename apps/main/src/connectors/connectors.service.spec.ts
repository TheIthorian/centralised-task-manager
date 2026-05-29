import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ConnectorsService } from './connectors.service.js';
import { ConnectorName } from '@ctm/connectors';
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
    };
    const mockEncryption = {
        decrypt: vi.fn((v: string) => `decrypted-${v}`),
        encrypt: vi.fn((v: string) => `encrypted-${v}`),
    };
    const mockRegistry = { get: vi.fn().mockReturnValue(mockConnector) };
    const mockJwt = { sign: vi.fn(), verify: vi.fn() };

    const service = new ConnectorsService(mockModel as any, mockRegistry as any, mockEncryption as any, mockJwt as any);

    return { service, mockModel, mockConnector, mockEncryption };
}

describe('ConnectorsService.ensureFreshTokens', () => {
    it('returns decrypted tokens without refresh when expiry is > 5 minutes away', async () => {
        const { service, mockConnector } = makeService({
            tokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
        });

        const result = await service.ensureFreshTokens({
            userId: new Types.ObjectId().toString(),
            source: ConnectorName.Todoist,
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
            source: ConnectorName.Todoist,
        });

        expect(mockConnector.refreshToken).toHaveBeenCalled();
        expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
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
                source: ConnectorName.Todoist,
            }),
        ).rejects.toThrow(NotFoundException);
    });
});
