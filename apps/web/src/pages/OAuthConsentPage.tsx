import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Navigate } from 'react-router';
import type { OAuthClientInfoDto } from '@ctm/api-client';
import { Button, UnverifiedAppNotice } from '@ctm/ui';
import { useAuth } from '../auth/AuthContext.js';
import config from '../config.js';

type ScopeEntry = {
    scope: string;
    label: string;
};

type ScopeGroup = {
    resource: string;
    label: string;
    entries: ScopeEntry[];
};

// i18next reads a colon as a namespace separator, so a scope cannot be a key as it stands.
const SCOPE_LABEL_KEYS = {
    openid: 'oauth.consent.scopes.openid',
    'tasks:read': 'oauth.consent.scopes.tasks_read',
    'tasks:write': 'oauth.consent.scopes.tasks_write',
    'connectors:read': 'oauth.consent.scopes.connectors_read',
    'connectors:write': 'oauth.consent.scopes.connectors_write',
    'connectors:sync': 'oauth.consent.scopes.connectors_sync',
    'notifications:read': 'oauth.consent.scopes.notifications_read',
    'notification-config:read': 'oauth.consent.scopes.notification-config_read',
    'notification-config:write': 'oauth.consent.scopes.notification-config_write',
    'profile:read': 'oauth.consent.scopes.profile_read',
    'profile:write': 'oauth.consent.scopes.profile_write',
} as const;

const RESOURCE_LABEL_KEYS = {
    tasks: 'oauth.consent.resources.tasks',
    connectors: 'oauth.consent.resources.connectors',
    notifications: 'oauth.consent.resources.notifications',
    'notification-config': 'oauth.consent.resources.notification-config',
    profile: 'oauth.consent.resources.profile',
} as const;

type ScopeName = keyof typeof SCOPE_LABEL_KEYS;
type ResourceName = keyof typeof RESOURCE_LABEL_KEYS;

/** OAuth consent page — shown when a client requests access to CTM. */
export function OAuthConsentPage(): React.JSX.Element {
    const { t } = useTranslation();
    const [params] = useSearchParams();
    const { user, isLoading, api } = useAuth();

    const rawScope = params.get('scope') ?? 'openid';
    const clientId = params.get('client_id');
    const requestedScopes = rawScope.split(/\s+/).filter(isKnownScope);

    if (!requestedScopes.includes('openid')) requestedScopes.unshift('openid');

    const [selected, setSelected] = useState<Set<string>>(() => new Set(requestedScopes));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // A failed lookup is not evidence that the client is trustworthy, but blocking consent on a
    // metadata call would break the flow for a network blip, so the screen renders without the
    // notice rather than retrying or erroring.
    const { data: clientInfo } = useQuery<OAuthClientInfoDto>({
        queryKey: ['oauth-client-info', clientId],
        queryFn: () => api.getOAuthClientInfo({ clientId: clientId ?? '' }),
        enabled: Boolean(clientId),
        retry: false,
    });

    const scopeGroups = buildScopeGroups({
        requestedScopes,
        scopeLabel: (scope) => t(SCOPE_LABEL_KEYS[scope]),
        resourceLabel: (resource) => t(RESOURCE_LABEL_KEYS[resource]),
    });

    if (isLoading) return <></>;

    if (!user) {
        const returnTo = `/oauth/consent?${params.toString()}`;
        return <Navigate to={`/login?return=${encodeURIComponent(returnTo)}`} replace />;
    }

    const appName = clientInfo?.clientName || clientId;

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

        if (clientId) {
            postParams.set('client_id', clientId);
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
                setError(t('oauth.consent.sessionExpired'));
            } else {
                setError(t('oauth.consent.failed'));
            }
        } catch {
            setError(t('oauth.consent.failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-panel border border-line p-8 rounded-ctm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em]st text-muted mb-1">
                    {appName
                        ? t('oauth.consent.requestingAccess', { app: appName })
                        : t('oauth.consent.requestingAccessUnnamed')}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-fg mb-1">{t('oauth.consent.title')}</h1>
                <p className="text-sm font-medium text-muted mb-5">
                    {t('oauth.consent.signedInAs', { email: user.email })}
                </p>

                {clientInfo && !clientInfo.isVerified && (
                    <div className="mb-5">
                        <UnverifiedAppNotice
                            title={t('oauth.consent.unverified.title')}
                            body={t('oauth.consent.unverified.body')}
                            hostsLabel={t('oauth.consent.unverified.hostsLabel')}
                            hosts={clientInfo.redirectHosts}
                        />
                    </div>
                )}

                {/* Permissions box */}
                <div className="border border-line bg-panel mb-5 rounded-ctm">
                    <div className="px-3 py-2 border-b border-line bg-hair">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em]st text-muted">
                            {t('oauth.consent.permissions')}
                        </span>
                    </div>

                    {/* openid — locked */}
                    <div className="px-3 py-2.5 border-b border-line flex gap-3 items-center opacity-50">
                        <div className="w-4 h-4 border border-line bg-hair flex-shrink-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-muted" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted">{t('oauth.consent.scopes.openid')}</p>
                            <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                                {t('oauth.consent.required', { scope: 'openid' })}
                            </p>
                        </div>
                    </div>

                    {/* Resource groups */}
                    {scopeGroups.map((group, idx, arr) => (
                        <div
                            key={group.resource}
                            className={idx < arr.length - 1 ? 'px-3 py-2.5 border-b border-line' : 'px-3 py-2.5'}
                        >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]st text-fg mb-2">
                                {group.label}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                {group.entries.map((entry) => {
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
                                                className={`w-4 h-4 border border-line flex-shrink-0 flex items-center justify-center ${
                                                    checked ? 'bg-accent' : 'bg-panel'
                                                }`}
                                            >
                                                {checked && <div className="w-2 h-2 bg-accent-fg" />}
                                            </div>
                                            <span className="text-xs font-medium text-fg">{entry.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="border border-warn bg-warn-bg p-3 mb-4 rounded-ctm">
                        <p className="text-warn font-medium text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? t('oauth.consent.submitting') : t('oauth.consent.submit')}
                    </Button>
                </form>

                <p className="mt-4 text-center text-xs font-medium text-muted">{t('oauth.consent.redirectNote')}</p>
            </div>
        </div>
    );
}

/** Groups the requested scopes by the resource they act on. `openid` is rendered separately. */
function buildScopeGroups({
    requestedScopes,
    scopeLabel,
    resourceLabel,
}: {
    requestedScopes: ScopeName[];
    scopeLabel: (scope: ScopeName) => string;
    resourceLabel: (resource: ResourceName) => string;
}): ScopeGroup[] {
    const groups = new Map<ResourceName, ScopeGroup>();

    for (const scope of requestedScopes) {
        const resource = resourceOf(scope);

        if (!resource) continue;

        let group = groups.get(resource);

        if (!group) {
            group = { resource, label: resourceLabel(resource), entries: [] };
            groups.set(resource, group);
        }

        group.entries.push({ scope, label: scopeLabel(scope) });
    }

    return [...groups.values()];
}

/** The resource a scope acts on, or null for a scope that names no resource (`openid`). */
function resourceOf(scope: ScopeName): ResourceName | null {
    const resource = scope.slice(0, scope.indexOf(':'));

    return resource in RESOURCE_LABEL_KEYS ? (resource as ResourceName) : null;
}

/** Narrows an arbitrary scope string to one this screen knows how to describe. */
function isKnownScope(scope: string): scope is ScopeName {
    return scope in SCOPE_LABEL_KEYS;
}
