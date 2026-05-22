// apps/main/src/sync/sync.controller.ts
import { Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { SyncService } from './sync.service.js';
import type { TaskSyncJobDocument } from '../jobs/schemas/task-sync-job.schema.js';

interface AuthRequest {
    user: JwtPayload;
}

type SyncJobDto = {
    id: string;
    type: string;
    status: string;
    source: string;
    stage: string | null;
    synced: number;
    skipped: number;
    error: string | null;
    completedAt: string | null;
};

function toDto(job: TaskSyncJobDocument): SyncJobDto {
    return {
        id: String(job._id),
        type: job.type,
        status: job.status,
        source: job.source,
        stage: job.stage,
        synced: job.synced,
        skipped: job.skipped,
        error: job.error,
        completedAt: job.completedAt?.toISOString() ?? null,
    };
}

@ApiTags('Sync')
@Controller('connectors/:source/sync')
@ApiBearerAuth('jwt')
@UseGuards(CombinedAuthGuard)
export class SyncController {
    constructor(private readonly sync: SyncService) {}

    /** Start a pull-sync job for a connected source. */
    @ApiOperation({ summary: 'Start a pull-sync job for a connector source' })
    @Post()
    async createJob(
        @Request() req: AuthRequest,
        @Param('source') source: string,
    ): Promise<SyncJobDto> {
        const job = await this.sync.createJob({ userId: req.user.sub, source });

        return toDto(job);
    }

    /** Get the status of a sync job. */
    @ApiOperation({ summary: 'Get status of a sync job' })
    @Get(':jobId')
    async getJob(
        @Request() req: AuthRequest,
        @Param('jobId') jobId: string,
    ): Promise<SyncJobDto> {
        const job = await this.sync.getJob({ userId: req.user.sub, jobId });

        return toDto(job);
    }

    /** Cancel a running or queued sync job. */
    @ApiOperation({ summary: 'Cancel a sync job' })
    @ApiResponse({ status: 204 })
    @Delete(':jobId')
    @HttpCode(204)
    async cancelJob(
        @Request() req: AuthRequest,
        @Param('jobId') jobId: string,
    ): Promise<void> {
        await this.sync.cancelJob({ userId: req.user.sub, jobId });
    }
}
