/** A client this project ships itself, registered at boot instead of through RFC 7591. */
export type FirstPartyClient = {
    clientId: string;
    clientName: string;
    redirectUris: string[];
    scopes: string[];
};

/** The CLI's client id, baked into `apps/cli` so it never registers itself. */
export const CLI_CLIENT_ID = 'ctm-cli';

const CLI_SCOPES = [
    'openid',
    'profile:read',
    'tasks:read',
    'tasks:write',
    'connectors:read',
    'connectors:write',
    'notifications:read',
    'notification-config:read',
    'notification-config:write',
];

/**
 * Loopback redirect URIs are matched host-only (RFC 8252 §7.3), so the CLI's ephemeral
 * callback port needs no registration.
 */
export const FIRST_PARTY_CLIENTS: FirstPartyClient[] = [
    {
        clientId: CLI_CLIENT_ID,
        clientName: 'CTM CLI',
        redirectUris: ['http://127.0.0.1', 'http://localhost'],
        scopes: CLI_SCOPES,
    },
];
