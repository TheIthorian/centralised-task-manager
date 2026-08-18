import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';

/** One entry of the trust list: a host, and optionally the path prefix within it that is trusted. */
type TrustedOrigin = { host: string; pathPrefix: string };

/**
 * Decides whether this server vouches for a client, which is the difference between a consent
 * screen that names an app and one that warns the user it cannot confirm who is asking.
 *
 * Verification is evaluated on every read rather than stored, so editing the trust list takes
 * effect without waiting for cached metadata documents to expire.
 */
@Injectable()
export class ClientTrustService {
    private readonly trusted: TrustedOrigin[];

    constructor(config: ConfigService) {
        this.trusted = parseTrustedOrigins(config.getOrThrow<string>('CIMD_TRUSTED_DOMAINS'));
    }

    /** True when the client's identity rests on something stronger than its own claim. */
    isVerified(client: OAuthClientDocument): boolean {
        if (client.registrationType === OAuthClientRegistration.FirstParty) return true;

        // A dynamic registration proves nothing: anyone may post any name to the registration
        // endpoint. A metadata document is served from the client_id URL, so control of that URL
        // is the claim, and the trust list says which URLs this server accepts it from.
        if (client.registrationType !== OAuthClientRegistration.ClientIdMetadataDocument) return false;

        return this.isTrustedOrigin(client.clientId);
    }

    private isTrustedOrigin(clientId: string): boolean {
        if (!URL.canParse(clientId)) return false;

        const { hostname, pathname } = new URL(clientId);

        return this.trusted.some((entry) => {
            if (hostname !== entry.host && !hostname.endsWith(`.${entry.host}`)) return false;

            if (entry.pathPrefix === '') return true;

            // A prefix match on a path has to stop at a segment boundary, or `/oauth` would also
            // vouch for `/oauthsomethingelse`.
            return pathname === entry.pathPrefix || pathname.startsWith(`${entry.pathPrefix}/`);
        });
    }
}

/**
 * Split the configured trust list.
 *
 * An entry is a host, optionally followed by the path prefix within it that is trusted:
 * `example.com` vouches for anything the host serves, `example.com/oauth` only for that subtree.
 * Give a path whenever the host also serves content its own users publish, since otherwise a
 * document uploaded by one of them is indistinguishable from one the vendor published.
 *
 * A bare host covers its subdomains, so only list one whose subdomains are not handed out.
 */
export function parseTrustedOrigins(value: string): TrustedOrigin[] {
    return value
        .split(',')
        .map((entry) =>
            entry
                .trim()
                .toLowerCase()
                .replace(/^https:\/\//, '')
                .replace(/\/+$/, ''),
        )
        .filter((entry) => entry.length > 0)
        .map((entry) => {
            const separator = entry.indexOf('/');

            if (separator === -1) return { host: entry, pathPrefix: '' };

            return { host: entry.slice(0, separator), pathPrefix: entry.slice(separator) };
        });
}
