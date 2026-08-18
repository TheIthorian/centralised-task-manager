import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { AuthCode, type AuthCodeDocument, OAuthClientRegistration, RefreshTokenGrant } from '@ctm/db';
import { AuthorizedClientService } from './authorized-client.service.js';
import { OAuthClientService } from './oauth-client.service.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from '../tokens/access-token.service.js';
import { RefreshTokenService } from '../tokens/refresh-token.service.js';
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
        private readonly users: UsersService,
        private readonly accessTokens: AccessTokenService,
        private readonly refreshTokens: RefreshTokenService,
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
        clientId: string;
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
        clientId: string;
    }): Promise<TokenResponse> {
        const accessToken = this.accessTokens.signAccessToken({ userId, email, clientId });
        const idToken = this.accessTokens.signIdToken({ userId, email });

        const refreshToken = await this.refreshTokens.issue({
            userId,
            clientId,
            grant: RefreshTokenGrant.OAuth,
            scopes,
        });

        await this.recordGrant({ userId, clientId, scopes });

        return {
            access_token: accessToken,
            id_token: idToken,
            token_type: 'Bearer',
            expires_in: this.accessTokens.expiresInSeconds,
            scope: scopes.join(' '),
            refresh_token: refreshToken,
        };
    }

    /** Exchange a refresh token for a new token set (rotates the refresh token). */
    async refreshAccessToken({ refreshToken }: { refreshToken: string }): Promise<TokenResponse> {
        const record = await this.refreshTokens.redeem({ rawToken: refreshToken, grant: RefreshTokenGrant.OAuth });
        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens({
            userId: record.userId,
            email: user.email,
            scopes: record.scopes,
            clientId: record.clientId,
        });
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
            registrationType: client?.registrationType ?? OAuthClientRegistration.Dynamic,
        });
    }
}
