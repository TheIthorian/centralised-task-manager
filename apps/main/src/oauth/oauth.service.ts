import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthCode, type AuthCodeDocument } from './schemas/auth-code.schema.js';
import { RefreshToken, type RefreshTokenDocument } from '../auth/schemas/refresh-token.schema.js';
import { AuthorizedClientService } from '../auth/authorized-client.service.js';
import { OAuthClientService } from '../auth/oauth-client.service.js';
import { UsersService } from '../users/users.service.js';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { UNREGISTERED_CLIENT } from '../rate-limit/principal-resolver.js';
import {
    CODE_CHALLENGE_METHODS,
    isSupportedCodeChallengeMethod,
    verifyCodeChallenge,
    type CodeChallengeMethod,
} from './pkce.js';

/** Token set returned from the OAuth token endpoint. */
export interface TokenResponse {
    access_token: string;
    id_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
    refresh_token: string;
}

@Injectable()
export class OAuthService {
    constructor(
        @InjectModel(AuthCode.name) private readonly authCodeModel: Model<AuthCodeDocument>,
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly authorizedClients: AuthorizedClientService,
        private readonly oauthClients: OAuthClientService,
    ) {}

    /**
     * Create a short-lived authorization code after the user authenticates.
     * Stores PKCE code challenge for verification at token exchange.
     */
    async createAuthCode({
        userId,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        scopes,
        clientId,
    }: {
        userId: string;
        redirectUri: string;
        codeChallenge: string;
        codeChallengeMethod: CodeChallengeMethod;
        scopes: string[];
        clientId?: string;
    }): Promise<string> {
        const code = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await this.authCodeModel.create({
            code,
            userId,
            redirectUri,
            codeChallenge,
            codeChallengeMethod,
            scopes,
            expiresAt,
            clientId,
        });

        return code;
    }

    /**
     * Exchange an authorization code for tokens.
     * Verifies PKCE code_verifier against stored code_challenge.
     */
    async exchangeCode({
        code,
        redirectUri,
        codeVerifier,
    }: {
        code: string;
        redirectUri: string;
        codeVerifier: string;
    }): Promise<TokenResponse> {
        const authCode = await this.authCodeModel.findOneAndDelete({ code });

        if (!authCode) throw new BadRequestException('Invalid or expired authorization code');

        if (authCode.redirectUri !== redirectUri) throw new BadRequestException('redirect_uri mismatch');

        if (new Date() > authCode.expiresAt) throw new BadRequestException('Authorization code expired');

        const { codeChallengeMethod } = authCode;

        if (!isSupportedCodeChallengeMethod(codeChallengeMethod)) {
            throw new BadRequestException(
                `Unsupported code_challenge_method: ${CODE_CHALLENGE_METHODS.join(', ')} only`,
            );
        }

        const verified = verifyCodeChallenge({
            codeVerifier,
            codeChallenge: authCode.codeChallenge,
            codeChallengeMethod,
        });

        if (!verified) throw new BadRequestException('code_verifier does not match code_challenge');

        const user = await this.users.findById(authCode.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens({
            userId: String(user._id),
            email: user.email,
            scopes: authCode.scopes,
            clientId: authCode.clientId,
        });
    }

    /** Issue access_token + id_token + refresh_token for a user. */
    async issueTokens({
        userId,
        email,
        scopes,
        clientId,
    }: {
        userId: string;
        email: string;
        scopes: string[];
        clientId?: string;
    }): Promise<TokenResponse> {
        const issuer = this.config.get<string>('REDIRECT_BASE_URL')!;
        const expiresInSeconds = this.config.get<number>('JWT_ACCESS_EXPIRES', 120);

        const payload: JwtPayload & Record<string, unknown> = {
            sub: userId,
            email,
            iss: issuer,
            aud: issuer,
        };

        const signOptions = { expiresIn: expiresInSeconds };

        // client_id rides on the access token so rate limiting can fence one client's traffic
        // off from the same user's other clients (RFC 9068 §2.2). The claim is always set:
        // /oauth/authorize accepts callers that do not identify themselves, and without it
        // their tokens would be indistinguishable from first-party ones and share that fence.
        const accessToken = this.jwt.sign({ ...payload, client_id: clientId ?? UNREGISTERED_CLIENT }, signOptions);
        const idToken = this.jwt.sign(payload, signOptions);

        const rawRefresh = `rt_${randomBytes(32).toString('hex')}`;
        const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
        const expiresInDays = this.config.get<number>('REFRESH_TOKEN_EXPIRES_DAYS', 30);
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        await this.refreshTokenModel.create({ tokenHash, userId, expiresAt, scopes, clientId });

        if (clientId) await this.recordGrant({ userId, clientId, scopes });

        return {
            access_token: accessToken,
            id_token: idToken,
            token_type: 'Bearer',
            expires_in: expiresInSeconds,
            scope: scopes.join(' '),
            refresh_token: rawRefresh,
        };
    }

    /**
     * Record the user's grant alongside the refresh token, so the authorized apps list is read
     * from an explicit link rather than inferred from credentials that expire.
     */
    private async recordGrant({
        userId,
        clientId,
        scopes,
    }: {
        userId: string;
        clientId: string;
        scopes: string[];
    }): Promise<void> {
        const client = await this.oauthClients.findByClientId(clientId);

        await this.authorizedClients.recordAuthorization({
            userId,
            clientId,
            scopes,
            isDynamic: client?.isDynamic ?? true,
        });
    }

    /** Exchange a refresh token for a new token set (rotates the refresh token). */
    async refreshAccessToken({ refreshToken }: { refreshToken: string }): Promise<TokenResponse> {
        const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
        const record = await this.refreshTokenModel.findOneAndDelete({ tokenHash });

        if (!record || record.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens({
            userId: record.userId,
            email: user.email,
            scopes: record.scopes,
            clientId: record.clientId,
        });
    }

    /** Validate a password and return user info (for the login form submission). */
    async validatePassword({
        email,
        password,
    }: {
        email: string;
        password: string;
    }): Promise<{ id: string; email: string }> {
        const user = await this.users.findByEmail(email);

        if (!user) throw new UnauthorizedException('Invalid credentials');

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) throw new UnauthorizedException('Invalid credentials');

        return { id: String(user._id), email: user.email };
    }
}
