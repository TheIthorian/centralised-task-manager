import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditAction, AuditLog, type AuditLogDocument, type AuditTargetType } from '@ctm/db';

/** One page of audit entries, newest first. */
export type AuditPage = {
    entries: AuditLogDocument[];
    total: number;
};

/**
 * Append-only writer over the audit log.
 *
 * There is deliberately no update or delete: an operator surface whose record of what the
 * operator did can be edited by the operator records nothing.
 */
@Injectable()
export class AuditService {
    constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

    /**
     * Append an entry.
     *
     * A write failure propagates rather than being swallowed: an action whose record was lost
     * should fail loudly, not complete unrecorded.
     */
    async record({
        action,
        actor,
        targetType,
        targetId = null,
        targetLabel = null,
        ip = null,
        metadata = {},
    }: {
        action: AuditAction;
        actor: string;
        targetType: AuditTargetType;
        targetId?: string | null;
        targetLabel?: string | null;
        ip?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        await this.auditModel.create({ action, actor, targetType, targetId, targetLabel, ip, metadata });
    }

    /** Read the log newest-first, optionally narrowed to one action or one target. */
    async list({
        limit,
        skip,
        action,
        targetId,
    }: {
        limit: number;
        skip: number;
        action?: AuditAction;
        targetId?: string;
    }): Promise<AuditPage> {
        const filter: Record<string, unknown> = {};

        if (action) filter['action'] = action;
        if (targetId) filter['targetId'] = targetId;

        const [entries, total] = await Promise.all([
            this.auditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            this.auditModel.countDocuments(filter),
        ]);

        return { entries, total };
    }
}
