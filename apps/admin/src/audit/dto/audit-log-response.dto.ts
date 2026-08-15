import type { AuditLogEntryDto as IAuditLogEntryDto, AuditLogPageDto as IAuditLogPageDto } from '@ctm/api-client';

export class AuditLogEntryDto implements IAuditLogEntryDto {
    id!: string;
    action!: string;
    actor!: string;
    targetType!: string;
    targetId!: string | null;
    targetLabel!: string | null;
    ip!: string | null;
    metadata!: Record<string, unknown>;
    createdAt!: string;
}

export class AuditLogPageDto implements IAuditLogPageDto {
    entries!: AuditLogEntryDto[];
    total!: number;
}
