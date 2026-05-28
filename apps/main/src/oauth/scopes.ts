/** A single scope entry in the registry. */
export type ScopeEntry = {
    scope: string;
    label: string;
    required: boolean;
};

/** All known OAuth scopes keyed by scope string. */
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

/**
 * Filter a list of requested scopes to known scopes only.
 * Always includes `openid` regardless of input.
 */
export function filterScopes(requested: string[]): string[] {
    const known = requested.filter((s) => s in SCOPE_REGISTRY);

    if (!known.includes('openid')) known.unshift('openid');

    return known;
}

/** Resource prefix → list of scope entries, for display on the consent page. */
export type ScopeGroups = Record<string, ScopeEntry[]>;

/**
 * Group scope entries by their resource prefix (the part before `:`).
 * Scopes without a `:` (e.g. `openid`) are excluded — they are shown separately.
 */
export function groupScopesByResource(scopes: string[]): ScopeGroups {
    const groups: ScopeGroups = {};

    for (const scope of scopes) {
        const colonIdx = scope.indexOf(':');

        if (colonIdx === -1) continue;

        const resource = scope.slice(0, colonIdx);
        const entry = SCOPE_REGISTRY[scope];

        if (!entry) continue;

        if (!groups[resource]) groups[resource] = [];
        groups[resource].push(entry);
    }

    return groups;
}
