import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OAuthClient, OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';
import { AssetFetcher } from '@ctm/server-utility';
import { appLogger } from '../logging/app-logger.js';
import { ClientLogoService } from './client-logo.service.js';
import {
    clientIdMetadataSchema,
    supportedGrantTypes,
    supportedResponseTypes,
    type ClientIdMetadata,
} from './client-id-metadata.schema.js';

/** A document larger than this is not a client's metadata, whatever else it is. */
export const MAX_METADATA_BYTES = 64 * 1024;

/** Bounds on how long a fetched document is reused, whatever the origin's cache headers claim. */
export const MIN_METADATA_TTL_MS = 5 * 60 * 1000;
export const MAX_METADATA_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ClientIdMetadataService {
    private readonly logger = appLogger(ClientIdMetadataService.name);

    constructor(
        @InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>,
        private readonly assets: AssetFetcher,
        private readonly logos: ClientLogoService,
    ) {}

    /**
     * Resolve a Client ID Metadata Document URL to the client it describes, fetching the document
     * unless a fresh copy is already cached. Null when the document cannot be fetched or does not
     * describe this `client_id`.
     */
    async resolve({ clientId }: { clientId: string }): Promise<OAuthClientDocument | null> {
        const cached = await this.model.findOne({ clientId });

        if (cached?.metadataExpiresAt && cached.metadataExpiresAt > new Date()) return cached;

        const fetched = await this.fetchMetadata({ clientId });

        // A document that has stopped resolving does not retract the consent a user already gave,
        // so a stale copy still describes the client better than refusing the request would.
        if (!fetched) return cached ?? null;

        return this.cache({ clientId, metadata: fetched.metadata, ttlMs: fetched.ttlMs, previous: cached });
    }

    private async fetchMetadata({
        clientId,
    }: {
        clientId: string;
    }): Promise<{ metadata: ClientIdMetadata; ttlMs: number } | null> {
        const result = await this.assets.fetchAsset({
            uri: clientId,
            allowedContentTypes: ['application/json'],
            maxBytes: MAX_METADATA_BYTES,
            // The document has to be served by the `client_id` URL itself: a redirect would make
            // the fetched document's `client_id` disagree with the URL it was requested from.
            maxRedirects: 0,
        });

        if (!result.ok) {
            this.logger.warn({ clientId, rejection: result.rejection }, 'Client ID metadata document not fetched');

            return null;
        }

        const parsed = parseDocument(result.asset.body);

        if (!parsed.success) {
            this.logger.warn({ clientId, issues: parsed.issues }, 'Client ID metadata document rejected');

            return null;
        }

        if (parsed.metadata.client_id !== clientId) {
            this.logger.warn(
                { clientId, declared: parsed.metadata.client_id },
                'Client ID metadata document client_id mismatch',
            );

            return null;
        }

        const { grant_types: grantTypes, response_types: responseTypes } = parsed.metadata;

        if (!supportedGrantTypes(grantTypes).includes('authorization_code')) {
            this.logger.warn({ clientId, grantTypes }, 'Client ID metadata document declares no usable grant type');

            return null;
        }

        if (!supportedResponseTypes(responseTypes).includes('code')) {
            this.logger.warn(
                { clientId, responseTypes },
                'Client ID metadata document declares no usable response type',
            );

            return null;
        }

        return { metadata: parsed.metadata, ttlMs: cacheTtlMs(result.asset.headers['cache-control']) };
    }

    private async cache({
        clientId,
        metadata,
        ttlMs,
        previous,
    }: {
        clientId: string;
        metadata: ClientIdMetadata;
        ttlMs: number;
        previous: OAuthClientDocument | null;
    }): Promise<OAuthClientDocument> {
        const client = await this.model.findOneAndUpdate(
            { clientId },
            {
                $set: {
                    clientName: metadata.client_name,
                    redirectUris: metadata.redirect_uris,
                    // Only what this server can actually honour, so the stored client never claims
                    // a grant the token endpoint would refuse.
                    grantTypes: supportedGrantTypes(metadata.grant_types),
                    responseTypes: supportedResponseTypes(metadata.response_types),
                    scopes: metadata.scopes ?? ['openid', 'email', 'profile'],
                    isDynamic: true,
                    registrationType: OAuthClientRegistration.ClientIdMetadataDocument,
                    metadataExpiresAt: new Date(Date.now() + ttlMs),
                    logoUri: metadata.logo_uri,
                    clientUri: metadata.client_uri,
                    tosUri: metadata.tos_uri,
                    policyUri: metadata.policy_uri,
                    contacts: metadata.contacts,
                    softwareId: metadata.software_id,
                },
                $setOnInsert: { issuedAt: new Date() },
            },
            { upsert: true, returnDocument: 'after' },
        );

        if (metadata.logo_uri && metadata.logo_uri !== previous?.logoUri) {
            await this.logos.storeLogo({ clientId, logoUri: metadata.logo_uri });
        }

        return client;
    }
}

type ParsedDocument = { success: true; metadata: ClientIdMetadata } | { success: false; issues: string };

function parseDocument(body: Buffer): ParsedDocument {
    let json: unknown;

    try {
        json = JSON.parse(body.toString('utf8'));
    } catch {
        return { success: false, issues: 'not valid JSON' };
    }

    const parsed = clientIdMetadataSchema.safeParse(json);

    if (!parsed.success)
        return { success: false, issues: parsed.error.issues.map((issue) => issue.message).join('; ') };

    return { success: true, metadata: parsed.data };
}

/** `max-age` from a `Cache-Control` response header, clamped to this server's own bounds. */
function cacheTtlMs(cacheControl: string | undefined): number {
    const directives = cacheControl ?? '';

    if (/(?:^|,)\s*no-(?:store|cache)\s*(?:,|$)/i.test(directives)) return 0;

    const maxAge = /(?:^|,)\s*max-age\s*=\s*(\d+)/i.exec(directives);

    if (!maxAge?.[1]) return MIN_METADATA_TTL_MS;

    const ttlMs = Number(maxAge[1]) * 1000;

    return Math.min(Math.max(ttlMs, MIN_METADATA_TTL_MS), MAX_METADATA_TTL_MS);
}
