import type { ListAuditLogQueryDto, ListOAuthClientsQueryDto } from '@ctm/api-client';

/**
 * One place for the cache keys, so a mutation invalidating a list cannot drift from the query
 * that populated it.
 */
export const queryKeys = {
    identity: ['identity'] as const,
    metrics: ['metrics'] as const,
    availableScopes: ['available-scopes'] as const,
    oauthClients: (query: ListOAuthClientsQueryDto) => ['oauth-clients', query] as const,
    auditLog: (query: ListAuditLogQueryDto) => ['audit-log', query] as const,
};

/** Everything derived from the client list, for invalidating after a write. */
export const OAUTH_CLIENTS_KEY_PREFIX = ['oauth-clients'] as const;

/** The audit log gains an entry on every write, so it is invalidated alongside the clients. */
export const AUDIT_LOG_KEY_PREFIX = ['audit-log'] as const;
