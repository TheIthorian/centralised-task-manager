import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import type { TokenPair as TokenPairDto } from '@ctm/api-client';
import { UsersService } from '../users/users.service.js';
import { RefreshToken, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

/**
 * A newly issued token pair. `refreshToken` is optional on the wire type because
 * `AuthController` omits it for web clients, but is always present here.
 */
export type TokenPair = TokenPairDto & { refreshToken: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    ) {}

    /** Register a new user and return a token pair. */
    async register({ email, password, name }: { email: string; password: string; name?: string }): Promise<TokenPair> {
        const user = await this.users.create({ email, password, name });

        return this.issueTokens(user);
    }

    /** Issue a new access + refresh token pair for a validated user. */
    async issueTokens(user: UserDocument): Promise<TokenPair> {
        const payload: JwtPayload = { sub: String(user._id), email: user.email };
        const accessToken = this.jwt.sign(payload);

        const rawRefresh = `rt_${randomBytes(32).toString('hex')}`;
        const tokenHash = this.hashToken(rawRefresh);
        const expiresInDays = this.config.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_DAYS');
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        await this.refreshTokenModel.create({ tokenHash, grant: 'session', userId: String(user._id), expiresAt });

        return {
            accessToken,
            expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_EXPIRES'),
            refreshToken: rawRefresh,
            user: { id: String(user._id), email: user.email },
        };
    }

    /** Validate a refresh token and issue a new token pair. Old token is deleted (rotation). */
    async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
        const tokenHash = this.hashToken(rawRefreshToken);
        const record = await this.refreshTokenModel.findOneAndDelete({ tokenHash, grant: 'session' });

        if (!record || record.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens(user);
    }

    /** Delete every refresh token for a user, of either grant (logout everywhere, account deletion). */
    async revokeAllRefreshTokens(userId: string): Promise<void> {
        await this.refreshTokenModel.deleteMany({ userId });
    }

    /** Delete a single refresh token. No-op when the token is unknown. */
    async revokeRefreshToken({ rawRefreshToken }: { rawRefreshToken: string }): Promise<void> {
        const tokenHash = this.hashToken(rawRefreshToken);

        await this.refreshTokenModel.deleteOne({ tokenHash, grant: 'session' });
    }

    /** SHA-256 hash of a raw refresh token, used as the stored lookup key. */
    private hashToken(rawToken: string): string {
        return createHash('sha256').update(rawToken).digest('hex');
    }
}
