import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'node:crypto';
import type { JwksDto } from '@ctm/api-client';

@Injectable()
export class OAuthKeyService {
    private readonly privateKeyPem: string;
    private readonly publicKeyPem: string;

    constructor(config: ConfigService) {
        this.privateKeyPem = Buffer.from(config.getOrThrow<string>('RSA_PRIVATE_KEY'), 'base64').toString('utf8');
        this.publicKeyPem = Buffer.from(config.getOrThrow<string>('RSA_PUBLIC_KEY'), 'base64').toString('utf8');
    }

    /** Return the RSA private key as a PEM string. */
    getPrivateKeyPem(): string {
        return this.privateKeyPem;
    }

    /** Return the RSA public key as a PEM string. */
    getPublicKeyPem(): string {
        return this.publicKeyPem;
    }

    /** Return the JWKS representation of the public key. */
    getJwks(): JwksDto {
        const keyObject = createPublicKey(this.publicKeyPem);
        const jwk = keyObject.export({ format: 'jwk' }) as unknown as { kty: string; n: string; e: string };

        return {
            keys: [
                {
                    ...jwk,
                    use: 'sig',
                    alg: 'RS256',
                    kid: 'default',
                },
            ],
        };
    }
}
