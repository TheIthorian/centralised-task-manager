/** The operator behind a request, as Cloudflare Access identified them. */
export type AdminIdentityDto = {
    email: string;
    subject: string;
};

/** One recorded operator action. */
export type AuditLogEntryDto = {
    id: string;
    action: string;
    actor: string;
    targetType: string;
    targetId: string | null;
    targetLabel: string | null;
    ip: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
};

/** A page of audit entries, newest first. */
export type AuditLogPageDto = {
    entries: AuditLogEntryDto[];
    total: number;
};

/** Query for {@link AdminClient.listAuditLog}. */
export type ListAuditLogQueryDto = {
    limit?: number;
    skip?: number;
    action?: string;
    targetId?: string;
};

/** A count of something, broken down by a key. */
export type MetricBucketDto = {
    key: string;
    count: number;
};

/** Registered accounts. */
export type UserMetricsDto = {
    total: number;
    createdLast7Days: number;
    createdLast30Days: number;
};

/** Aggregated tasks across every account. */
export type TaskMetricsDto = {
    total: number;
    byStatus: MetricBucketDto[];
    bySource: MetricBucketDto[];
};

/** Connected external accounts, and how many are unhealthy. */
export type ConnectorMetricsDto = {
    total: number;
    enabled: number;
    /** Connections whose last sync attempt recorded an error. */
    failing: number;
    bySource: MetricBucketDto[];
};

/** Health of the background sync, over the trailing window. */
export type SyncMetricsDto = {
    /** When any sync job last completed successfully. Null if none ever has. */
    lastSucceededAt: string | null;
    succeededLast24Hours: number;
    failedLast24Hours: number;
    /** Jobs currently queued or running. A number that only grows means the worker is stuck. */
    inFlight: number;
};

/** Everything the operator dashboard shows at a glance. */
export type SiteMetricsDto = {
    users: UserMetricsDto;
    tasks: TaskMetricsDto;
    connectors: ConnectorMetricsDto;
    sync: SyncMetricsDto;
    /** When these figures were computed. They are not cached, so this is request time. */
    generatedAt: string;
};

/** A registered OAuth client, as the operator sees it. */
export type AdminOAuthClientDto = {
    clientId: string;
    clientName: string;
    redirectUris: string[];
    grantTypes: string[];
    responseTypes: string[];
    scopes: string[];
    /**
     * False for clients seeded from code at boot. Those are owned by the deployment, so the admin
     * API refuses to change or remove them.
     */
    isDynamic: boolean;
    clientUri: string | null;
    tosUri: string | null;
    policyUri: string | null;
    contacts: string[];
    softwareId: string | null;
    issuedAt: string;
    lastUsedAt: string | null;
};

/** A page of registered clients. */
export type AdminOAuthClientPageDto = {
    clients: AdminOAuthClientDto[];
    total: number;
};

/** Query for {@link AdminClient.listOAuthClients}. */
export type ListOAuthClientsQueryDto = {
    limit?: number;
    skip?: number;
    /** Narrow to dynamically registered clients, or to the code-seeded ones. */
    isDynamic?: boolean;
    /** Case-insensitive match against client name or id. */
    search?: string;
};

/** Payload for creating a client from the admin UI rather than dynamic registration. */
export type CreateOAuthClientDto = {
    clientName: string;
    redirectUris: string[];
    scopes: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    clientUri?: string;
    tosUri?: string;
    policyUri?: string;
    contacts?: string[];
};

/** Payload for changing a client's configuration. Every field is optional. */
export type UpdateOAuthClientDto = {
    clientName?: string;
    redirectUris?: string[];
    scopes?: string[];
    grantTypes?: string[];
    responseTypes?: string[];
    clientUri?: string | null;
    tosUri?: string | null;
    policyUri?: string | null;
    contacts?: string[];
};

/** The scopes an operator may grant, for populating the admin UI. */
export type AvailableScopeDto = {
    scope: string;
    label: string;
    required: boolean;
};
