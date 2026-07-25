import { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router';
import { Button } from '@ctm/ui';
import { useAuth } from '../auth/AuthContext.js';
import config from '../config.js';

type ScopeEntry = {
    scope: string;
    label: string;
    required: boolean;
};

type ScopeGroups = Record<string, ScopeEntry[]>;

const SCOPE_REGISTRY: Record<string, ScopeEntry> = {
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

function buildScopeGroups(requestedScopes: string[]): ScopeGroups {
    const groups: ScopeGroups = {};

    for (const scope of requestedScopes) {
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

/** OAuth consent page — shown when a client requests access to CTM. */
export function OAuthConsentPage(): React.JSX.Element {
    const [params] = useSearchParams();
    const { user, isLoading, api } = useAuth();

    const rawScope = params.get('scope') ?? 'openid';
    const requestedScopes = rawScope.split(/\s+/).filter((s) => s in SCOPE_REGISTRY);

    if (!requestedScopes.includes('openid')) requestedScopes.unshift('openid');

    const [selected, setSelected] = useState<Set<string>>(() => new Set(requestedScopes));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const scopeGroups = buildScopeGroups(requestedScopes);

    const RESOURCE_LABELS: Record<string, string> = {
        tasks: 'Tasks',
        connectors: 'Connectors',
        notifications: 'Notifications',
        'notification-config': 'Notification Config',
        profile: 'Profile',
    };

    if (isLoading) return <></>;

    if (!user) {
        const returnTo = `/oauth/consent?${params.toString()}`;
        return <Navigate to={`/login?return=${encodeURIComponent(returnTo)}`} replace />;
    }

    const toggleScope = (scope: string): void => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(scope)) {
                next.delete(scope);
            } else {
                next.add(scope);
            }
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const postParams = new URLSearchParams({
            response_type: params.get('response_type') ?? 'code',
            redirect_uri: params.get('redirect_uri') ?? '',
            code_challenge: params.get('code_challenge') ?? '',
            scope: rawScope,
            state: params.get('state') ?? '',
        });

        if (params.get('client_id')) {
            postParams.set('client_id', params.get('client_id')!);
        }

        const selectedWithOpenid = new Set(selected);
        selectedWithOpenid.add('openid');

        const accessToken = api.getAccessToken();

        const apiBase = config.apiUrl;

        try {
            const res = await fetch(`${apiBase}/oauth/authorize?${postParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ selected_scopes: [...selectedWithOpenid].join(' ') }),
            });

            if (res.ok) {
                const data = (await res.json()) as { location: string };

                window.location.assign(data.location);

                return;
            } else if (res.status === 401) {
                setError('Session expired. Please refresh and try again.');
            } else {
                setError('Something went wrong. Please try again.');
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border-4 border-nb-black dark:border-white/20 shadow-[6px_6px_0px_#111] dark:shadow-none p-8">
                <p className="text-xs font-black uppercase tracking-widest text-nb-grey mb-1">
                    CTM MCP Server is requesting access
                </p>
                <h1 className="text-3xl font-black uppercase tracking-tight text-nb-black dark:text-white mb-1">
                    Authorise CTM
                </h1>
                <p className="text-sm font-bold text-nb-grey mb-5">Signed in as {user.email}</p>

                {/* Permissions box */}
                <div className="border-2 border-nb-black mb-5" style={{ background: '#fffbe8' }}>
                    <div className="px-3 py-2 border-b-2 border-nb-black bg-[#f5f5f5]">
                        <span className="text-xs font-black uppercase tracking-widest text-nb-grey">
                            Permissions requested
                        </span>
                    </div>

                    {/* openid — locked */}
                    <div className="px-3 py-2.5 border-b border-[#e8e0b0] flex gap-3 items-center opacity-50">
                        <div className="w-4 h-4 border-2 border-[#ccc] bg-[#eee] flex-shrink-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-[#ccc]" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-[#aaa]">Verify identity</p>
                            <p className="text-[10px] font-bold text-[#ccc] uppercase tracking-wide">
                                openid · Required
                            </p>
                        </div>
                    </div>

                    {/* Resource groups */}
                    {Object.entries(scopeGroups).map(([resource, entries], idx, arr) => (
                        <div
                            key={resource}
                            className={idx < arr.length - 1 ? 'px-3 py-2.5 border-b border-[#e8e0b0]' : 'px-3 py-2.5'}
                        >
                            <p className="text-[10px] font-black uppercase tracking-widest text-nb-black mb-2">
                                {RESOURCE_LABELS[resource] ?? resource.charAt(0).toUpperCase() + resource.slice(1)}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                {entries.map((entry) => {
                                    const checked = selected.has(entry.scope);
                                    return (
                                        <button
                                            key={entry.scope}
                                            type="button"
                                            role="checkbox"
                                            aria-checked={checked}
                                            aria-label={entry.label}
                                            onClick={() => toggleScope(entry.scope)}
                                            className="flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <div
                                                className={`w-4 h-4 border-2 border-nb-black flex-shrink-0 flex items-center justify-center ${
                                                    checked ? 'bg-nb-yellow' : 'bg-white'
                                                }`}
                                            >
                                                {checked && <div className="w-2 h-2 bg-nb-black" />}
                                            </div>
                                            <span className="text-xs font-bold text-nb-black">{entry.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3 mb-4">
                        <p className="text-nb-red font-bold text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? 'Authorising…' : 'Authorise →'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-xs font-bold text-nb-grey">
                    You'll be redirected back to the requesting app after authorising.
                </p>
            </div>
        </div>
    );
}
