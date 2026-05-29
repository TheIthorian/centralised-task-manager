import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ApiTokenService } from './api-token.service.js';
import { ApiToken, ApiTokenSchema } from './schemas/api-token.schema.js';

describe('ApiTokenService', () => {
    let module: TestingModule;
    let service: ApiTokenService;
    const userId = new Types.ObjectId().toHexString();

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: ApiToken.name, schema: ApiTokenSchema }]),
            ],
            providers: [ApiTokenService],
        }).compile();

        service = module.get(ApiTokenService);
    });

    afterAll(async () => {
        await module.close();
    });

    it('create returns a ctm_ prefixed raw token', async () => {
        const { rawToken, record } = await service.create({ userId, label: 'my token' });

        expect(rawToken).toMatch(/^ctm_[0-9a-f]{64}$/);
        expect(record.label).toBe('my token');
    });

    it('validate returns userId for valid token', async () => {
        const { rawToken } = await service.create({ userId, label: 'validate test' });
        const result = await service.validate(rawToken);

        expect(result).toBe(userId);
    });

    it('validate returns null for unknown token', async () => {
        const result = await service.validate('ctm_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

        expect(result).toBeNull();
    });

    it('revoke throws NotFoundException when token not found', async () => {
        await expect(service.revoke({ tokenId: new Types.ObjectId().toHexString(), userId })).rejects.toThrow(
            NotFoundException,
        );
    });
});
