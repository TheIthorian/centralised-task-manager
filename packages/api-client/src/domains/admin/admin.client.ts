import type { ApiHttpClient } from '../../http/api-http-client.js';
import type { DomainClientOptions } from '../../http/http.types.js';
import type {
    AdminIdentityDto,
    AdminOAuthClientDto,
    AdminOAuthClientPageDto,
    AuditLogPageDto,
    AvailableScopeDto,
    CreateAdminOAuthClientParams,
    GetAdminOAuthClientParams,
    ListAuditLogQueryDto,
    ListOAuthClientsQueryDto,
    SiteMetricsDto,
    UpdateAdminOAuthClientParams,
} from './admin.types.js';

/**
 * The operator surface exposed by `apps/admin`.
 *
 * It carries no token of its own: Cloudflare Access authenticates the operator in front of the
 * origin, so the credential travels as a header the caller never sees.
 */
export class AdminClient {
    private readonly http: ApiHttpClient;

    constructor({ http }: DomainClientOptions) {
        this.http = http;
    }

    /** Who the deployment believes is making this request. */
    async getIdentity(): Promise<AdminIdentityDto> {
        return this.http.request<AdminIdentityDto>({ method: 'GET', path: '/auth/me' });
    }

    /** Aggregate counts across the whole deployment. */
    async getSiteMetrics(): Promise<SiteMetricsDto> {
        return this.http.request<SiteMetricsDto>({ method: 'GET', path: '/metrics' });
    }

    /** Read the audit log newest-first, optionally narrowed to one action or one target. */
    async listAuditLog(query: ListAuditLogQueryDto = {}): Promise<AuditLogPageDto> {
        return this.http.request<AuditLogPageDto>({
            method: 'GET',
            path: '/audit-log',
            params: toQueryParams(query),
        });
    }

    /** List registered OAuth clients, newest first. */
    async listOAuthClients(query: ListOAuthClientsQueryDto = {}): Promise<AdminOAuthClientPageDto> {
        return this.http.request<AdminOAuthClientPageDto>({
            method: 'GET',
            path: '/oauth-clients',
            params: toQueryParams(query),
        });
    }

    /** The scopes an operator may grant, for populating the client editor. */
    async listAvailableScopes(): Promise<AvailableScopeDto[]> {
        return this.http.request<AvailableScopeDto[]>({ method: 'GET', path: '/oauth-clients/available-scopes' });
    }

    /** Read one registered client. */
    async getOAuthClient({ clientId }: GetAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.http.request<AdminOAuthClientDto>({
            method: 'GET',
            path: `/oauth-clients/${encodeURIComponent(clientId)}`,
        });
    }

    /** Register a client from the operator UI rather than through dynamic registration. */
    async createOAuthClient({ dto }: CreateAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.http.request<AdminOAuthClientDto>({ method: 'POST', path: '/oauth-clients', body: dto });
    }

    /** Change a client's configuration. */
    async updateOAuthClient({ clientId, dto }: UpdateAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.http.request<AdminOAuthClientDto>({
            method: 'PATCH',
            path: `/oauth-clients/${encodeURIComponent(clientId)}`,
            body: dto,
        });
    }

    /** Remove a client, so it can no longer complete an authorization. */
    async revokeOAuthClient({ clientId }: GetAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.http.request<AdminOAuthClientDto>({
            method: 'DELETE',
            path: `/oauth-clients/${encodeURIComponent(clientId)}`,
        });
    }
}

/**
 * An absent filter and an empty filter are different requests: `search=''` would match nothing on
 * a server that treats it literally, so undefined keys are dropped rather than stringified.
 */
function toQueryParams(query: Record<string, string | number | boolean | undefined>): Record<string, string> {
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params[key] = String(value);
    }

    return params;
}
