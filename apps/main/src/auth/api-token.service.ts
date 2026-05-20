import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { ApiToken, type ApiTokenDocument } from './schemas/api-token.schema.js';

@Injectable()
export class ApiTokenService {
    constructor(@InjectModel(ApiToken.name) private readonly model: Model<ApiTokenDocument>) {}

    /** Issue a new API token. Returns the raw token (shown once) and the saved record. */
    async create({
        userId,
        label,
    }: {
        userId: string;
        label: string;
    }): Promise<{ rawToken: string; record: ApiTokenDocument }> {
        const raw = `ctm_${randomBytes(32).toString('hex')}`;
        const tokenHash = createHash('sha256').update(raw).digest('hex');
        const record = await this.model.create({ userId: new Types.ObjectId(userId), tokenHash, label });

        return { rawToken: raw, record };
    }

    /** List all tokens for a user (no raw token values). */
    async list(userId: string): Promise<ApiTokenDocument[]> {
        return this.model.find({ userId: new Types.ObjectId(userId) });
    }

    /** Revoke a token by id. Throws NotFoundException if not found or wrong user. */
    async revoke({ tokenId, userId }: { tokenId: string; userId: string }): Promise<void> {
        const result = await this.model.deleteOne({ _id: tokenId, userId: new Types.ObjectId(userId) });

        if (result.deletedCount === 0) throw new NotFoundException('Token not found');
    }

    /** Delete all API tokens for a user. Called on account deletion. */
    async deleteAllByUserId(userId: string): Promise<void> {
        await this.model.deleteMany({ userId: new Types.ObjectId(userId) });
    }

    /** Validate a raw token. Returns the userId string if valid, null otherwise. Updates lastUsedAt. */
    async validate(rawToken: string): Promise<string | null> {
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const record = await this.model.findOneAndUpdate({ tokenHash }, { lastUsedAt: new Date() }, { new: true });

        return record ? String(record.userId) : null;
    }
}
