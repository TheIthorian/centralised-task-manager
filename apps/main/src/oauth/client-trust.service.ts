import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';

/**
 * Decides whether this server vouches for a client, which is the difference between a consent
 * screen that names an app and one that warns the user it cannot confirm who is asking.
 *
 * Verification is evaluated on every read rather than stored, so adding a domain to the trust
 * list takes effect without waiting for cached metadata documents to expire.
 */
@Injectable()
export class ClientTrustService {
    private readonly trustedDomains: string[];

    constructor(config: ConfigService) {
        this.trustedDomains = parseTrustedDomains(config.getOrThrow<string>('CIMD_TRUSTED_DOMAINS'));
    }

    /** True when the client's identity rests on something stronger than its own claim. */
    isVerified(client: OAuthClientDocument): boolean {
        if (client.registrationType === OAuthClientRegistration.FirstParty) return true;

        // A dynamic registration proves nothing: anyone may post any name to the registration
        // endpoint. A metadata document is served from the client_id URL, so control of that
        // domain is the claim, and the trust list says which domains this server accepts it from.
        if (client.registrationType !== OAuthClientRegistration.ClientIdMetadataDocument) return false;

        return this.isTrustedDomain(client.clientId);
    }

    private isTrustedDomain(clientId: string): boolean {
        if (!URL.canParse(clientId)) return false;

        const { hostname } = new URL(clientId);

        return this.trustedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    }
}

/**
 * Split the configured trust list. Entries are registrable domains rather than whole URLs, so a
 * client that moves its metadata document stays verified, and subdomains of an entry are covered:
 * only list a domain whose subdomains are not handed out to other people.
 */
export function parseTrustedDomains(value: string): string[] {
    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
}
