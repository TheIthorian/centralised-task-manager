import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { RefreshToken, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    ) {}

    /** Register a new user and return a token pair. */
    async register({ email, password, name }: { email: string; password: string; name?: string }): Promise<TokenPair & { user: { id: string; email: string } }> {
        const user = await this.users.create({ email, password, name });

        return this.issueTokens(user);
    }

    /** Issue a new access + refresh token pair for a validated user. */
    async issueTokens(user: UserDocument): Promise<TokenPair & { user: { id: string; email: string } }> {
        const payload: JwtPayload = { sub: String(user._id), email: user.email };
        const accessToken = this.jwt.sign(payload);

        const rawRefresh = `rt_${randomBytes(32).toString('hex')}`;
        const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
        const expiresInDays = this.config.get<number>('REFRESH_TOKEN_EXPIRES_DAYS', 30);
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        await this.refreshTokenModel.create({ tokenHash, userId: String(user._id), expiresAt });

        return {
            accessToken,
            refreshToken: rawRefresh,
            user: { id: String(user._id), email: user.email },
        };
    }

    /** Validate a refresh token and issue a new token pair. Old token is deleted (rotation). */
    async refreshTokens(rawRefreshToken: string): Promise<TokenPair & { user: { id: string; email: string } }> {
        const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
        const record = await this.refreshTokenModel.findOneAndDelete({ tokenHash });

        if (!record || record.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens(user);
    }

    /** Delete all refresh tokens for a user (logout everywhere). */
    async revokeAllRefreshTokens(userId: string): Promise<void> {
        await this.refreshTokenModel.deleteMany({ userId });
    }
}
