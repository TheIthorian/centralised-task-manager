import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';

/**
 * Decides whether this server vouches for a client, which is the difference between a consent
 * screen that names an app and one that warns the user it cannot confirm who is asking.
 *
 * Verification is evaluated on every read rather than stored, so editing the trust list takes
 * effect without waiting for cached metadata documents to expire.
 */
@Injectable()
export class ClientTrustService {
    private readonly trustedClientIds: Set<string>;

    constructor(config: ConfigService) {
        this.trustedClientIds = parseTrustedClientIds(config.getOrThrow<string>('CIMD_TRUSTED_CLIENT_IDS'));
    }

    /** True when the client's identity rests on something stronger than its own claim. */
    isVerified(client: OAuthClientDocument): boolean {
        if (client.registrationType === OAuthClientRegistration.FirstParty) return true;

        // A dynamic registration proves nothing: anyone may post any name to the registration
        // endpoint. A metadata document is served from the client_id URL, so control of that URL
        // is the claim, and the trust list says which URLs this server accepts it from.
        if (client.registrationType !== OAuthClientRegistration.ClientIdMetadataDocument) return false;

        return this.trustedClientIds.has(client.clientId);
    }
}

/**
 * Split the configured trust list into whole `client_id` URLs.
 *
 * Compared exactly, so a client that moves its metadata document loses its badge until an operator
 * updates the list. That is a visible warning rather than a failed authorization, and it is worth
 * more than the alternative: trusting a host outright vouches for every document it serves,
 * including any its own users publish there.
 */
export function parseTrustedClientIds(value: string): Set<string> {
    return new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
    );
}
