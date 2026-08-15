import { Controller, Get } from '@nestjs/common';
import type { AuditLogEntryDto, AuditLogPageDto } from '@ctm/api-client';
import type { AuditLogDocument } from '@ctm/db';
import { ValidatedQuery } from '@ctm/nest-common';
import { AuditService } from './audit.service.js';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto.js';

@Controller('audit-log')
export class AuditController {
    constructor(private readonly audit: AuditService) {}

    /** Read the audit log newest-first, optionally narrowed to one action or one target. */
    @Get()
    async list(@ValidatedQuery(ListAuditLogQueryDto) query: ListAuditLogQueryDto): Promise<AuditLogPageDto> {
        const { entries, total } = await this.audit.list(query);

        return { entries: entries.map(toEntryDto), total };
    }
}

function toEntryDto(entry: AuditLogDocument): AuditLogEntryDto {
    return {
        id: String(entry._id),
        action: entry.action,
        actor: entry.actor,
        targetType: entry.targetType,
        targetId: entry.targetId,
        targetLabel: entry.targetLabel,
        ip: entry.ip,
        metadata: entry.metadata,
        createdAt: entry.get('createdAt').toISOString(),
    };
}
