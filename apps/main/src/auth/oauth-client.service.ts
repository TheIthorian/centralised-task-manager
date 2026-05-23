import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import type { OAuthClientDocument } from './schemas/oauth-client.schema.js';
import { OAuthClient } from './schemas/oauth-client.schema.js';

/** Input payload for RFC 7591 dynamic client registration. */
export type RegisterClientInput = {
    client_name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    scopes?: string[];
};

/** Response returned after successful dynamic client registration. */
export type RegisterClientOutput = {
    client_id: string;
    client_secret: string;
    client_name?: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    scopes: string[];
    issued_at: string;
};

@Injectable()
export class OAuthClientService {
    constructor(@InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>) {}

    /** Register a new OAuth client per RFC 7591. */
    async register(input: RegisterClientInput): Promise<RegisterClientOutput> {
        const clientId = this.generateClientId();
        const clientSecret = this.generateClientSecret();
        const clientSecretHash = await bcrypt.hash(clientSecret, 10);

        const doc = new this.model({
            clientId,
            clientSecretHash,
            clientName: input.client_name || '',
            redirectUris: input.redirect_uris,
            grantTypes: input.grant_types ?? ['authorization_code'],
            responseTypes: input.response_types ?? ['code'],
            scopes: input.scopes ?? ['openid', 'email', 'profile'],
            issuedAt: new Date(),
        });

        await doc.save();

        return {
            client_id: clientId,
            client_secret: clientSecret,
            client_name: input.client_name,
            redirect_uris: input.redirect_uris,
            grant_types: doc.grantTypes,
            response_types: doc.responseTypes,
            scopes: doc.scopes,
            issued_at: doc.issuedAt.toISOString(),
        };
    }

    private generateClientId(): string {
        return `client_${randomBytes(16).toString('hex')}`;
    }

    private generateClientSecret(): string {
        return randomBytes(32).toString('hex');
    }
}
