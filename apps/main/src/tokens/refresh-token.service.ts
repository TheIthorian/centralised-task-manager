import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { RefreshToken, RefreshTokenGrant, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';

@Injectable()
export class RefreshTokenService {
    constructor(
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
        private readonly config: ConfigService,
    ) {}

    /** How long a newly issued refresh token stays redeemable, in days. */
    get expiresInDays(): number {
        return this.config.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_DAYS');
    }

    /** Issue a refresh token and store its hash. Returns the raw token, which is never stored. */
    async issue({
        userId,
        clientId,
        grant,
        scopes = [],
    }: {
        userId: string;
        clientId: string;
        grant: RefreshTokenGrant;
        scopes?: string[];
    }): Promise<string> {
        const rawToken = `rt_${randomBytes(32).toString('hex')}`;

        await this.refreshTokenModel.create({
            tokenHash: hashToken(rawToken),
            grant,
            userId,
            clientId,
            scopes,
            expiresAt: new Date(Date.now() + this.expiresInDays * 24 * 60 * 60 * 1000),
        });

        return rawToken;
    }

    /**
     * Consume a refresh token and return its record, deleting it in the same operation (rotation).
     *
     * The grant is part of the lookup, not a check afterwards, so a token issued by one flow is
     * simply not found at the other flow's endpoint.
     *
     * @throws UnauthorizedException when the token is unknown, already used, or expired.
     */
    async redeem({ rawToken, grant }: { rawToken: string; grant: RefreshTokenGrant }): Promise<RefreshTokenDocument> {
        const record = await this.refreshTokenModel.findOneAndDelete({ tokenHash: hashToken(rawToken), grant });

        if (!record || record.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        return record;
    }

    /** Delete a single refresh token. No-op when the token is unknown. */
    async revoke({ rawToken, grant }: { rawToken: string; grant: RefreshTokenGrant }): Promise<void> {
        await this.refreshTokenModel.deleteOne({ tokenHash: hashToken(rawToken), grant });
    }

    /** Delete every refresh token for a user, of either grant (logout everywhere, account deletion). */
    async revokeAllForUser(userId: string): Promise<void> {
        await this.refreshTokenModel.deleteMany({ userId });
    }

    /** Delete every refresh token issued to a client, for every user. */
    async revokeAllForClient(clientId: string): Promise<void> {
        await this.refreshTokenModel.deleteMany({ clientId });
    }

    /** Delete the refresh tokens one user holds for one client. */
    async revokeForUserAndClient({ userId, clientId }: { userId: string; clientId: string }): Promise<void> {
        await this.refreshTokenModel.deleteMany({ userId, clientId });
    }
}

/** SHA-256 hash of a raw refresh token, used as the stored lookup key. */
function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}
