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

/** One day's worth of new records. */
export type GrowthPointDto = {
    /** Calendar day in `YYYY-MM-DD`, in UTC. */
    date: string;
    users: number;
    tasks: number;
};

/** New users and tasks per day over the requested window. */
export type GrowthMetricsDto = {
    points: GrowthPointDto[];
};

/** Query for {@link AdminClient.getGrowthMetrics}. */
export type GrowthMetricsQueryDto = {
    days?: number;
};
