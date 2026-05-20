import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiTokenService } from './api-token.service.js';
import { ApiToken } from './schemas/api-token.schema.js';

describe('ApiTokenService', () => {
    let service: ApiTokenService;
    let mockModel: {
        create: ReturnType<typeof vi.fn>;
        find: ReturnType<typeof vi.fn>;
        deleteOne: ReturnType<typeof vi.fn>;
        findOneAndUpdate: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockModel = {
            create: vi.fn(),
            find: vi.fn(),
            deleteOne: vi.fn(),
            findOneAndUpdate: vi.fn(),
        };
        const module = await Test.createTestingModule({
            providers: [
                ApiTokenService,
                { provide: getModelToken(ApiToken.name), useValue: mockModel },
            ],
        }).compile();

        service = module.get(ApiTokenService);
    });

    it('create returns a ctm_ prefixed raw token', async () => {
        mockModel.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', label: 'my token', userId: '507f1f77bcf86cd799439011' });
        const { rawToken, record } = await service.create({ userId: '507f1f77bcf86cd799439011', label: 'my token' });

        expect(rawToken).toMatch(/^ctm_[0-9a-f]{64}$/);
        expect(record.label).toBe('my token');
    });

    it('validate returns userId for valid token', async () => {
        mockModel.findOneAndUpdate.mockResolvedValue({ userId: 'user-id-123' });
        const result = await service.validate('ctm_abc');

        expect(result).toBe('user-id-123');
    });

    it('validate returns null for unknown token', async () => {
        mockModel.findOneAndUpdate.mockResolvedValue(null);
        const result = await service.validate('ctm_bad');

        expect(result).toBeNull();
    });

    it('revoke throws NotFoundException when token not found', async () => {
        mockModel.deleteOne.mockResolvedValue({ deletedCount: 0 });
        await expect(
            service.revoke({ tokenId: '507f1f77bcf86cd799439011', userId: '507f1f77bcf86cd799439011' }),
        ).rejects.toThrow(NotFoundException);
    });
});
