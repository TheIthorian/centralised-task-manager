import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims, IdTokenClaims } from './token-claims.js';

/**
 * The one place access tokens and id tokens are minted.
 *
 * Both the first-party login flow and the OAuth authorization grant sign through here, so a claim
 * added for one of them cannot be missing from the other's tokens.
 */
@Injectable()
export class AccessTokenService {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) {}

    /** Lifetime of a freshly signed access token, in seconds. */
    get expiresInSeconds(): number {
        return this.config.getOrThrow<number>('JWT_ACCESS_EXPIRES');
    }

    /** Sign an access token for a user acting through a given client. */
    signAccessToken({ userId, email, clientId }: { userId: string; email: string; clientId: string }): string {
        const claims: AccessTokenClaims = { ...this.baseClaims({ userId, email }), client_id: clientId };

        return this.jwt.sign(claims, { expiresIn: this.expiresInSeconds });
    }

    /** Sign an OIDC id token for a user. */
    signIdToken({ userId, email }: { userId: string; email: string }): string {
        return this.jwt.sign(this.baseClaims({ userId, email }), { expiresIn: this.expiresInSeconds });
    }

    private baseClaims({ userId, email }: { userId: string; email: string }): IdTokenClaims {
        const issuer = this.config.getOrThrow<string>('REDIRECT_BASE_URL');

        return { sub: userId, email, iss: issuer, aud: issuer };
    }
}
