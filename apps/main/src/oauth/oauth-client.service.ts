import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import type { OAuthClientInfoDto } from '@ctm/api-client';
import { OAuthClient, OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';
import type { FirstPartyClient } from '../oauth/first-party-clients.js';
import { ClientLogoService } from './client-logo.service.js';
import { ClientIdMetadataService } from './client-id-metadata.service.js';
import { isClientIdMetadataDocumentUrl } from './client-id.js';
import { ClientTrustService } from './client-trust.service.js';

/** Input payload for RFC 7591 dynamic client registration. */
export type RegisterClientInput = {
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    scopes?: string[];
    logo_uri?: string;
    client_uri?: string;
    tos_uri?: string;
    policy_uri?: string;
    contacts?: string[];
    software_id?: string;
};

/** Response returned after successful dynamic client registration. */
export type RegisterClientOutput = {
    client_id: string;

    /**
     * Always `none`: dynamically registered clients are public and authenticate the authorization
     * code exchange with PKCE, not with a credential (RFC 7591 §3.2.1, RFC 8252 §8.4).
     */
    token_endpoint_auth_method: 'none';
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    scopes: string[];
    issued_at: string;
    logo_uri?: string;
    client_uri?: string;
    tos_uri?: string;
    policy_uri?: string;
    contacts?: string[];
    software_id?: string;
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

const WEB_SCHEMES = new Set(['http:', 'https:']);

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

        // A private-use scheme carries no authority to anchor the comparison: `myapp:/a` and
        // `myapp:/b` differ only in their path, so the whole URI has to match.
        if (!WEB_SCHEMES.has(requested.protocol)) return reg.href === requested.href;

        if (reg.hostname !== requested.hostname) return false;

        if (!isLoopback && reg.port !== requested.port) return false;

        return true;
    });
}

/** How long an unused dynamically registered client is kept before it is reaped. */
export const UNUSED_CLIENT_TTL_DAYS = 30;

@Injectable()
export class OAuthClientService {
    constructor(
        @InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>,
        private readonly logos: ClientLogoService,
        private readonly clientIdMetadata: ClientIdMetadataService,
        private readonly trust: ClientTrustService,
    ) {}

    /** Register a new OAuth client per RFC 7591. */
    async register(input: RegisterClientInput): Promise<RegisterClientOutput> {
        const clientId = this.generateClientId();
        const issuedAt = new Date();

        const doc = new this.model({
            clientId,
            clientName: input.client_name,
            redirectUris: input.redirect_uris,
            grantTypes: input.grant_types ?? ['authorization_code'],
            responseTypes: input.response_types ?? ['code'],
            scopes: input.scopes ?? ['openid', 'email', 'profile'],
            issuedAt,
            registrationType: OAuthClientRegistration.Dynamic,
            unusedExpiresAt: new Date(issuedAt.getTime() + UNUSED_CLIENT_TTL_DAYS * 24 * 60 * 60 * 1000),
            logoUri: input.logo_uri,
            clientUri: input.client_uri,
            tosUri: input.tos_uri,
            policyUri: input.policy_uri,
            contacts: input.contacts,
            softwareId: input.software_id,
        });

        await doc.save();

        // Fetched once here rather than per page view, so no user's browser ever contacts the
        // client's host.
        if (input.logo_uri) await this.logos.storeLogo({ clientId, logoUri: input.logo_uri });

        return {
            client_id: clientId,
            token_endpoint_auth_method: 'none',
            client_name: doc.clientName,
            redirect_uris: input.redirect_uris,
            grant_types: doc.grantTypes,
            response_types: doc.responseTypes,
            scopes: doc.scopes,
            issued_at: doc.issuedAt.toISOString(),
            // RFC 7591 §3.2.1: the response repeats the metadata that was actually registered.
            logo_uri: doc.logoUri,
            client_uri: doc.clientUri,
            tos_uri: doc.tosUri,
            policy_uri: doc.policyUri,
            contacts: doc.contacts,
            software_id: doc.softwareId,
        };
    }

    /**
     * Register the clients this project ships, so they never have to register themselves.
     * Idempotent: an upsert per client, run on every boot, and the definition in code wins.
     */
    async ensureFirstPartyClients(clients: FirstPartyClient[]): Promise<void> {
        for (const client of clients) {
            await this.model.updateOne(
                { clientId: client.clientId },
                {
                    $set: {
                        clientName: client.clientName,
                        redirectUris: client.redirectUris,
                        scopes: client.scopes,
                        grantTypes: ['authorization_code', 'refresh_token'],
                        responseTypes: ['code'],
                        isDynamic: false,
                        registrationType: OAuthClientRegistration.FirstParty,
                    },
                    $setOnInsert: { issuedAt: new Date() },
                    // Never reaped: a first-party client has to exist before its first use.
                    $unset: { unusedExpiresAt: '' },
                },
                { upsert: true },
            );
        }
    }

    /** Find a registered client by its client_id. */
    async findByClientId(clientId: string): Promise<OAuthClientDocument | null> {
        return this.model.findOne({ clientId });
    }

    /**
     * Find the client a `client_id` names, resolving it through its Client ID Metadata Document
     * when the id is a URL rather than an identifier this server issued.
     */
    async resolveByClientId(clientId: string): Promise<OAuthClientDocument | null> {
        if (isClientIdMetadataDocumentUrl(clientId)) return this.clientIdMetadata.resolve({ clientId });

        return this.findByClientId(clientId);
    }

    /**
     * Public metadata for a client, for a consent screen to describe who is asking. Null when the
     * client_id is not registered.
     *
     * Only the host of each redirect URI is exposed: the path and query are noise a user cannot
     * judge, while the host is the part that answers where the authorization code is being sent.
     */
    async getPublicClientInfo({ clientId }: { clientId: string }): Promise<OAuthClientInfoDto | null> {
        const client = await this.resolveByClientId(clientId);

        if (!client) return null;

        return {
            clientId: client.clientId,
            clientName: client.clientName,
            isVerified: this.trust.isVerified(client),
            redirectHosts: redirectHostsOf(client.redirectUris),
        };
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
}

/** Distinct hosts of the given redirect URIs, in registration order. Unparseable URIs are skipped. */
function redirectHostsOf(redirectUris: string[]): string[] {
    const hosts = new Set<string>();

    for (const uri of redirectUris) {
        if (!URL.canParse(uri)) continue;

        const url = new URL(uri);

        // A private-use scheme often carries no authority, and a blank entry tells a user nothing.
        hosts.add(url.host || url.protocol);
    }

    return [...hosts];
}
