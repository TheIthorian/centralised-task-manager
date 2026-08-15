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
