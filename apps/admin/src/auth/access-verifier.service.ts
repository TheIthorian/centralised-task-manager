import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { UnauthorizedError } from '@ctm/errors';
import type { AccessIdentity } from './access-identity.js';

@Injectable()
export class AccessVerifierService {
    private readonly issuer: string;
    private readonly audience: string;
    private readonly jwks: JWTVerifyGetKey;

    constructor(config: ConfigService) {
        this.issuer = `https://${config.getOrThrow<string>('CF_ACCESS_TEAM_DOMAIN')}`;
        this.audience = config.getOrThrow<string>('CF_ACCESS_AUD');

        // createRemoteJWKSet caches the key set and refetches on an unknown `kid`, so key rotation
        // costs one extra request rather than an outage.
        this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/cdn-cgi/access/certs`));
    }

    /**
     * Verify an Access token and return the operator it identifies.
     *
     * @throws UnauthorizedError when the token is absent, malformed, expired, signed by a key
     * outside the team's JWKS, or issued for a different Access application.
     */
    async verify(token: string | undefined): Promise<AccessIdentity> {
        if (!token) throw new UnauthorizedError('No Cloudflare Access token on the request');

        try {
            const { payload } = await jwtVerify(token, this.jwks, {
                issuer: this.issuer,
                // Scoped to this Access application: a token minted for any other application in
                // the same team is signed by the same keys and would otherwise verify here.
                audience: this.audience,
            });

            const email = payload['email'];

            if (typeof email !== 'string' || !payload.sub) {
                throw new UnauthorizedError('Access token carries no identity');
            }

            return { email, subject: payload.sub };
        } catch (err: unknown) {
            if (err instanceof UnauthorizedError) throw err;

            throw new UnauthorizedError('Cloudflare Access token is invalid or has expired');
        }
    }
}
