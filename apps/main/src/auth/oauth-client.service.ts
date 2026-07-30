import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import type { OAuthClientDocument } from './schemas/oauth-client.schema.js';
import { OAuthClient } from './schemas/oauth-client.schema.js';

/** Input payload for RFC 7591 dynamic client registration. */
export type RegisterClientInput = {
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    scopes?: string[];
};

/** Response returned after successful dynamic client registration. */
export type RegisterClientOutput = {
    client_id: string;
    client_secret: string;
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    scopes: string[];
    issued_at: string;
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

/**
 * Returns true if requestedUri is permitted by the registered list.
 * For loopback hosts (127.0.0.1, ::1, localhost) the port is ignored per RFC 8252 §7.3.
 * All other URIs require an exact match.
 */
export function isRedirectUriPermitted(registeredUris: string[], requestedUri: string): boolean {
    let requested: URL;

    try {
        requested = new URL(requestedUri);
    } catch {
        return false;
    }

    const isLoopback = LOOPBACK_HOSTS.has(requested.hostname);

    return registeredUris.some((registered) => {
        let reg: URL;

        try {
            reg = new URL(registered);
        } catch {
            return false;
        }

        if (reg.protocol !== requested.protocol) return false;
        if (reg.hostname !== requested.hostname) return false;

        if (!isLoopback && reg.port !== requested.port) return false;

        return true;
    });
}

/** How long an unused dynamically registered client is kept before it is reaped. */
export const UNUSED_CLIENT_TTL_DAYS = 30;

@Injectable()
export class OAuthClientService {
    constructor(@InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>) {}

    /** Register a new OAuth client per RFC 7591. */
    async register(input: RegisterClientInput): Promise<RegisterClientOutput> {
        const clientId = this.generateClientId();
        const clientSecret = this.generateClientSecret();
        const clientSecretHash = await bcrypt.hash(clientSecret, 10);
        const issuedAt = new Date();

        const doc = new this.model({
            clientId,
            clientSecretHash,
            clientName: input.client_name,
            redirectUris: input.redirect_uris,
            grantTypes: input.grant_types ?? ['authorization_code'],
            responseTypes: input.response_types ?? ['code'],
            scopes: input.scopes ?? ['openid', 'email', 'profile'],
            issuedAt,
            unusedExpiresAt: new Date(issuedAt.getTime() + UNUSED_CLIENT_TTL_DAYS * 24 * 60 * 60 * 1000),
        });

        await doc.save();

        return {
            client_id: clientId,
            client_secret: clientSecret,
            client_name: doc.clientName,
            redirect_uris: input.redirect_uris,
            grant_types: doc.grantTypes,
            response_types: doc.responseTypes,
            scopes: doc.scopes,
            issued_at: doc.issuedAt.toISOString(),
        };
    }

    /** Find a registered client by its client_id. */
    async findByClientId(clientId: string): Promise<OAuthClientDocument | null> {
        return this.model.findOne({ clientId });
    }

    /**
     * Record that a client completed an authorization, exempting it from unused-client reaping.
     * Safe to call repeatedly.
     */
    async markUsed({ clientId }: { clientId: string }): Promise<void> {
        await this.model.updateOne({ clientId }, { $set: { lastUsedAt: new Date() }, $unset: { unusedExpiresAt: '' } });
    }

    private generateClientId(): string {
        return `client_${randomBytes(16).toString('hex')}`;
    }

    private generateClientSecret(): string {
        return randomBytes(32).toString('hex');
    }
}
