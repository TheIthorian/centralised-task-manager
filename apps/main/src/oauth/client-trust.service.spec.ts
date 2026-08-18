import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';
import { ClientTrustService, parseTrustedOrigins } from './client-trust.service.js';

describe('parseTrustedOrigins', () => {
    it('splits, trims and lowercases, dropping empty entries', () => {
        expect(parseTrustedOrigins(' Claude.ai , ,example.com ')).toEqual([
            { host: 'claude.ai', pathPrefix: '' },
            { host: 'example.com', pathPrefix: '' },
        ]);
    });

    it('separates a path prefix from the host, ignoring a scheme and a trailing slash', () => {
        expect(parseTrustedOrigins('https://claude.ai/oauth/')).toEqual([{ host: 'claude.ai', pathPrefix: '/oauth' }]);
    });

    it('reads an empty setting as trusting nobody', () => {
        expect(parseTrustedOrigins('')).toEqual([]);
    });
});

describe('ClientTrustService', () => {
    const trust = trustService('claude.ai');

    it('vouches for a first-party client', () => {
        expect(
            trust.isVerified(client({ clientId: 'ctm-cli', registrationType: OAuthClientRegistration.FirstParty })),
        ).toBe(true);
    });

    it('vouches for a metadata document on a trusted domain', () => {
        expect(trust.isVerified(cimdClient('https://claude.ai/oauth/mcp-oauth-client-metadata'))).toBe(true);
    });

    it('vouches for a metadata document on a subdomain of a trusted domain', () => {
        expect(trust.isVerified(cimdClient('https://app.claude.ai/client.json'))).toBe(true);
    });

    it('does not vouch for a lookalike domain that merely ends in the trusted one', () => {
        expect(trust.isVerified(cimdClient('https://notclaude.ai/client.json'))).toBe(false);
        expect(trust.isVerified(cimdClient('https://claude.ai.evil.example/client.json'))).toBe(false);
    });

    it('does not vouch for a metadata document on an untrusted domain', () => {
        expect(trust.isVerified(cimdClient('https://someone-else.example/client.json'))).toBe(false);
    });

    describe('an entry that names a path', () => {
        const scoped = trustService('claude.ai/oauth');

        it('vouches for a document inside that path', () => {
            expect(scoped.isVerified(cimdClient('https://claude.ai/oauth/mcp-oauth-client-metadata'))).toBe(true);
        });

        it('does not vouch for a document the host serves elsewhere', () => {
            expect(scoped.isVerified(cimdClient('https://claude.ai/public/artifacts/abc/client.json'))).toBe(false);
        });

        it('stops the prefix at a path segment boundary', () => {
            expect(scoped.isVerified(cimdClient('https://claude.ai/oauth-impostor/client.json'))).toBe(false);
        });
    });

    it('never vouches for a client that registered itself', () => {
        expect(
            trust.isVerified(client({ clientId: 'client_abc', registrationType: OAuthClientRegistration.Dynamic })),
        ).toBe(false);
    });

    it('vouches for nothing dynamic when the trust list is empty', () => {
        expect(trustService('').isVerified(cimdClient('https://claude.ai/client.json'))).toBe(false);
    });
});

function trustService(trustedDomains: string): ClientTrustService {
    return new ClientTrustService({ getOrThrow: () => trustedDomains } as unknown as ConfigService);
}

function cimdClient(clientId: string): OAuthClientDocument {
    return client({ clientId, registrationType: OAuthClientRegistration.ClientIdMetadataDocument });
}

function client({
    clientId,
    registrationType,
}: {
    clientId: string;
    registrationType: OAuthClientRegistration;
}): OAuthClientDocument {
    return { clientId, registrationType } as OAuthClientDocument;
}
