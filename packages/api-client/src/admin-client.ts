import { AdminClient } from './domains/admin/admin.client.js';
import type {
    AdminApiClientOptions,
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
} from './domains/admin/admin.types.js';
import { ApiHttpClient } from './http/api-http-client.js';

/**
 * Typed REST client for the operator API in `apps/admin`.
 *
 * Separate from {@link CtmApiClient} because it is a different server with a different
 * authentication model, not a section of the product API.
 */
export class CtmAdminClient {
    private readonly admin: AdminClient;

    constructor({ baseUrl }: AdminApiClientOptions) {
        this.admin = new AdminClient({ http: new ApiHttpClient({ baseUrl }) });
    }

    /** Who the deployment believes is making this request. */
    async getIdentity(): Promise<AdminIdentityDto> {
        return this.admin.getIdentity();
    }

    /** Aggregate counts across the whole deployment. */
    async getSiteMetrics(): Promise<SiteMetricsDto> {
        return this.admin.getSiteMetrics();
    }

    /** Read the audit log newest-first, optionally narrowed to one action or one target. */
    async listAuditLog(query: ListAuditLogQueryDto = {}): Promise<AuditLogPageDto> {
        return this.admin.listAuditLog(query);
    }

    /** List registered OAuth clients, newest first. */
    async listOAuthClients(query: ListOAuthClientsQueryDto = {}): Promise<AdminOAuthClientPageDto> {
        return this.admin.listOAuthClients(query);
    }

    /** The scopes an operator may grant, for populating the client editor. */
    async listAvailableScopes(): Promise<AvailableScopeDto[]> {
        return this.admin.listAvailableScopes();
    }

    /** Read one registered client. */
    async getOAuthClient(params: GetAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.admin.getOAuthClient(params);
    }

    /** Register a client from the operator UI rather than through dynamic registration. */
    async createOAuthClient(params: CreateAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.admin.createOAuthClient(params);
    }

    /** Change a client's configuration. */
    async updateOAuthClient(params: UpdateAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.admin.updateOAuthClient(params);
    }

    /** Remove a client, so it can no longer complete an authorization. */
    async revokeOAuthClient(params: GetAdminOAuthClientParams): Promise<AdminOAuthClientDto> {
        return this.admin.revokeOAuthClient(params);
    }
}
