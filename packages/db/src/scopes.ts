/** A single scope entry in the registry. */
export type ScopeEntry = {
    scope: string;
    label: string;
    required: boolean;
};

/**
 * All known OAuth scopes keyed by scope string.
 *
 * Lives here because `OAuthClient.scopes` and `AuthorizedClient.scopes` persist these strings, and
 * both the authorization server and the admin app have to agree on which ones exist. The label
 * travels with the scope rather than sitting in a second table keyed by the same strings, which
 * would be the pair of lists that drift.
 */
export const SCOPE_REGISTRY: Record<string, ScopeEntry> = {
    openid: { scope: 'openid', label: 'Verify identity', required: true },
    'tasks:read': { scope: 'tasks:read', label: 'Read tasks', required: false },
    'tasks:write': { scope: 'tasks:write', label: 'Create & manage tasks', required: false },
    'connectors:read': { scope: 'connectors:read', label: 'Read connectors', required: false },
    'connectors:write': { scope: 'connectors:write', label: 'Manage connectors', required: false },
    'connectors:sync': { scope: 'connectors:sync', label: 'Trigger connector sync', required: false },
    'notifications:read': { scope: 'notifications:read', label: 'Read notifications', required: false },
    'notification-config:read': {
        scope: 'notification-config:read',
        label: 'Read notification prefs',
        required: false,
    },
    'notification-config:write': {
        scope: 'notification-config:write',
        label: 'Manage notification prefs',
        required: false,
    },
    'profile:read': { scope: 'profile:read', label: 'Read profile', required: false },
    'profile:write': { scope: 'profile:write', label: 'Update profile', required: false },
};

/** Every known scope string. */
export const KNOWN_SCOPES: string[] = Object.keys(SCOPE_REGISTRY);
