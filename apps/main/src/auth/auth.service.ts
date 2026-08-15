import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { TokenPair as TokenPairDto } from '@ctm/api-client';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from '../tokens/access-token.service.js';
import { RefreshTokenService } from '../tokens/refresh-token.service.js';
import { RefreshTokenGrant, type UserDocument } from '@ctm/db';
import { FIRST_PARTY_CLIENT } from '../rate-limit/principal-resolver.js';

/**
 * A newly issued token pair. `refreshToken` is optional on the wire type because
 * `AuthController` omits it for web clients, but is always present here.
 */
export type TokenPair = TokenPairDto & { refreshToken: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly accessTokens: AccessTokenService,
        private readonly refreshTokens: RefreshTokenService,
    ) {}

    /** Register a new user and return a token pair. */
    async register({ email, password, name }: { email: string; password: string; name?: string }): Promise<TokenPair> {
        const user = await this.users.create({ email, password, name });

        return this.issueTokens(user);
    }

    /** Issue a new access + refresh token pair for a validated user. */
    async issueTokens(user: UserDocument): Promise<TokenPair> {
        const userId = String(user._id);
        const accessToken = this.accessTokens.signAccessToken({
            userId,
            email: user.email,
            clientId: FIRST_PARTY_CLIENT,
        });

        const refreshToken = await this.refreshTokens.issue({
            userId,
            clientId: FIRST_PARTY_CLIENT,
            grant: RefreshTokenGrant.Session,
        });

        return {
            accessToken,
            expiresIn: this.accessTokens.expiresInSeconds,
            refreshToken,
            user: { id: userId, email: user.email },
        };
    }

    /** Validate a refresh token and issue a new token pair. Old token is deleted (rotation). */
    async refreshSession(rawRefreshToken: string): Promise<TokenPair> {
        const record = await this.refreshTokens.redeem({
            rawToken: rawRefreshToken,
            grant: RefreshTokenGrant.Session,
        });

        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens(user);
    }

    /** Delete a single session refresh token. No-op when the token is unknown. */
    async revokeRefreshToken({ rawRefreshToken }: { rawRefreshToken: string }): Promise<void> {
        await this.refreshTokens.revoke({ rawToken: rawRefreshToken, grant: RefreshTokenGrant.Session });
    }
}
