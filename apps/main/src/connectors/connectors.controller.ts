import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { ConnectorsService } from './connectors.service.js';
import { UpdateConnectorDto } from './dto/update-connector.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Connectors')
@Controller('connectors')
export class ConnectorsController {
    constructor(private readonly connectors: ConnectorsService) {}

    /** List available connector source names. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List available connector sources' })
    @Get()
    @UseGuards(CombinedAuthGuard)
    listAvailable(): string[] {
        return this.connectors.listAvailable();
    }

    /** List the current user's connector configs. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: "List the user's connected sources" })
    @Get('configs')
    @UseGuards(CombinedAuthGuard)
    async listConfigs(@Request() req: AuthRequest): Promise<unknown[]> {
        const configs = await this.connectors.listConfigs(req.user.sub);

        return configs.map((c) => ({
            id: String(c._id),
            source: c.source,
            enabled: c.enabled,
            lastSyncedAt: c.lastSyncedAt,
            lastError: c.lastError,
        }));
    }

    /** Get the OAuth URL for a connector source. */
    @ApiBearerAuth('jwt')
    @ApiOperation({
        summary: 'Get OAuth URL to connect a source',
        description: 'Returns a redirect URL the user must visit to authorise CTM with the external service.',
    })
    @Post('configs')
    @UseGuards(CombinedAuthGuard)
    async getOAuthUrl(@Request() req: AuthRequest, @Body('source') source: string): Promise<{ url: string }> {
        const url = await this.connectors.getOAuthUrl({ userId: req.user.sub, source });

        return { url };
    }

    /** OAuth callback — called by the provider after user grants access. */
    @ApiOperation({
        summary: 'OAuth callback (called by provider)',
        description: 'This endpoint is called by the external provider after the user grants access.',
    })
    @Get('oauth/callback/:source')
    async oauthCallback(
        @Param('source') source: string,
        @Query('code') code: string,
        @Query('state') state: string,
    ): Promise<{ id: string; source: string }> {
        const doc = await this.connectors.handleCallback({ source, code, userId: state });

        return { id: String(doc._id), source: doc.source };
    }

    /** Update a connector config. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Update a connector config' })
    @Patch('configs/:id')
    @UseGuards(CombinedAuthGuard)
    async update(
        @Request() req: AuthRequest,
        @Param('id') id: string,
        @Body() dto: UpdateConnectorDto,
    ): Promise<{ id: string; enabled: boolean }> {
        const doc = await this.connectors.update({ configId: id, userId: req.user.sub, patch: dto });

        return { id: String(doc._id), enabled: doc.enabled };
    }

    /** Remove a connector config. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Remove a connector config' })
    @ApiResponse({ status: 204 })
    @Delete('configs/:id')
    @UseGuards(CombinedAuthGuard)
    @HttpCode(204)
    async remove(@Request() req: AuthRequest, @Param('id') id: string): Promise<void> {
        await this.connectors.remove({ configId: id, userId: req.user.sub });
    }
}
