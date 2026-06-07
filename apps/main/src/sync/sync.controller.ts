import { Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ConnectorName } from '@ctm/connectors';
import type { TaskSyncJobDto } from '@ctm/api-client';
import { SyncService } from './sync.service.js';
import { toSyncJobDto } from './sync-job.dto.js';

type AuthRequest = {
    user: JwtPayload;
};

@ApiTags('Sync')
@Controller('connectors/:source/sync')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class SyncController {
    constructor(private readonly sync: SyncService) {}

    /** Start a pull-sync job for a connected source. */
    @ApiOperation({ summary: 'Start a pull-sync job for a connector source' })
    @Post()
    async createJob(@Request() req: AuthRequest, @Param('source') source: ConnectorName): Promise<TaskSyncJobDto> {
        const job = await this.sync.createJob({ userId: req.user.sub, source });

        return toSyncJobDto(job);
    }

    /** Get the status of a sync job. */
    @ApiOperation({ summary: 'Get status of a sync job' })
    @Get(':jobId')
    async getJob(@Request() req: AuthRequest, @Param('jobId') jobId: string): Promise<TaskSyncJobDto> {
        const job = await this.sync.getJob({ userId: req.user.sub, jobId });

        return toSyncJobDto(job);
    }

    /** Cancel a running or queued sync job. */
    @ApiOperation({ summary: 'Cancel a sync job' })
    @ApiResponse({ status: 204 })
    @Delete(':jobId')
    @HttpCode(204)
    async cancelJob(@Request() req: AuthRequest, @Param('jobId') jobId: string): Promise<void> {
        await this.sync.cancelJob({ userId: req.user.sub, jobId });
    }
}
