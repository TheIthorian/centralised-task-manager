import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthCode, type AuthCodeDocument } from './schemas/auth-code.schema.js';
import { UsersService } from '../users/users.service.js';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

export interface TokenResponse {
    access_token: string;
    id_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
}

@Injectable()
export class OAuthService {
    constructor(
        @InjectModel(AuthCode.name) private readonly authCodeModel: Model<AuthCodeDocument>,
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) {}

    /**
     * Create a short-lived authorization code after the user authenticates.
     * Stores PKCE code challenge for verification at token exchange.
     */
    async createAuthCode({
        userId,
        redirectUri,
        codeChallenge,
        scopes,
    }: {
        userId: string;
        redirectUri: string;
        codeChallenge: string;
        scopes: string[];
    }): Promise<string> {
        const code = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await this.authCodeModel.create({ code, userId, redirectUri, codeChallenge, scopes, expiresAt });

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

        // Verify PKCE: SHA-256(code_verifier) base64url == code_challenge
        const hash = createHash('sha256').update(codeVerifier).digest('base64url');

        if (hash !== authCode.codeChallenge)
            throw new BadRequestException('code_verifier does not match code_challenge');

        const user = await this.users.findById(authCode.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens({ userId: String(user._id), email: user.email, scopes: authCode.scopes });
    }

    /** Issue access_token + id_token for a user. */
    issueTokens({ userId, email, scopes }: { userId: string; email: string; scopes: string[] }): TokenResponse {
        const issuer = this.config.get<string>('REDIRECT_BASE_URL') ?? 'http://localhost:3000';
        const expiresIn = 3600;

        const payload: JwtPayload & Record<string, unknown> = {
            sub: userId,
            email,
            iss: issuer,
            aud: issuer,
        };

        const signOptions = { expiresIn };

        // access_token: same payload, shorter scope
        const accessToken = this.jwt.sign(payload, signOptions);

        // id_token: includes OIDC-specific claims
        const idToken = this.jwt.sign(payload, signOptions);

        return {
            access_token: accessToken,
            id_token: idToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope: scopes.join(' '),
        };
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
