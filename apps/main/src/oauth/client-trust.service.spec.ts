import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OAuthClientRegistration, type OAuthClientDocument } from '@ctm/db';
import { ClientTrustService, parseTrustedClientIds } from './client-trust.service.js';

const CLAUDE_CLIENT_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';

describe('parseTrustedClientIds', () => {
    it('splits and trims, dropping empty entries', () => {
        expect(parseTrustedClientIds(` ${CLAUDE_CLIENT_ID} , ,https://example.com/client.json `)).toEqual(
            new Set([CLAUDE_CLIENT_ID, 'https://example.com/client.json']),
        );
    });

    it('reads an empty setting as trusting nobody', () => {
        expect(parseTrustedClientIds('')).toEqual(new Set());
    });
});

describe('ClientTrustService', () => {
    const trust = trustService(CLAUDE_CLIENT_ID);

    it('vouches for a first-party client', () => {
        expect(
            trust.isVerified(client({ clientId: 'ctm-cli', registrationType: OAuthClientRegistration.FirstParty })),
        ).toBe(true);
    });

    it('vouches for a listed metadata document', () => {
        expect(trust.isVerified(cimdClient(CLAUDE_CLIENT_ID))).toBe(true);
    });

    it('does not vouch for another document the same host serves', () => {
        expect(trust.isVerified(cimdClient('https://claude.ai/public/artifacts/abc/client.json'))).toBe(false);
    });

    it('does not vouch for a document on a lookalike host', () => {
        expect(trust.isVerified(cimdClient('https://claude.ai.evil.example/oauth/mcp-oauth-client-metadata'))).toBe(
            false,
        );
    });

    it('does not vouch for an unlisted document', () => {
        expect(trust.isVerified(cimdClient('https://someone-else.example/client.json'))).toBe(false);
    });

    it('never vouches for a client that registered itself', () => {
        expect(
            trust.isVerified(client({ clientId: 'client_abc', registrationType: OAuthClientRegistration.Dynamic })),
        ).toBe(false);
    });

    it('vouches for nothing dynamic when the trust list is empty', () => {
        expect(trustService('').isVerified(cimdClient(CLAUDE_CLIENT_ID))).toBe(false);
    });
});

function trustService(trustedClientIds: string): ClientTrustService {
    return new ClientTrustService({ getOrThrow: () => trustedClientIds } as unknown as ConfigService);
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
