/** Credentials for the single operator account. */
export type AdminLoginDto = {
    username: string;
    password: string;
};

/** Result of a successful operator login. */
export type AdminSessionDto = {
    username: string;
    expiresInSeconds: number;
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
