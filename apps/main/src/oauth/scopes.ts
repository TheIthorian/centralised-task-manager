import { SCOPE_REGISTRY, type ScopeEntry } from '@ctm/db';

export { SCOPE_REGISTRY, type ScopeEntry };

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
