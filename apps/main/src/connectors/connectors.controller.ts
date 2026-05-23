import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    Request,
    Res,
    UseGuards,
    HttpCode,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ConnectorRegistry, NotionConnector } from '@ctm/connectors';
import type { ConnectionDetailsSchema } from '@ctm/connectors';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import { ConnectorsService } from './connectors.service.js';
import { DiscordService } from './discord.service.js';
import { UpdateConnectorDto } from './dto/update-connector.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Connectors')
@Controller('connectors')
export class ConnectorsController {
    private readonly logger = new Logger(ConnectorsController.name);

    constructor(
        private readonly connectors: ConnectorsService,
        private readonly discord: DiscordService,
        private readonly registry: ConnectorRegistry,
        private readonly config: ConfigService,
    ) {}

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

    /** List connector statuses (available + connection state) for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List connector statuses for the current user' })
    @Get('status')
    @UseGuards(CombinedAuthGuard)
    async listStatus(
        @Request() req: AuthRequest,
    ): Promise<{ source: string; connected: boolean; lastSynced?: string }[]> {
        const available = this.connectors.listAvailable();
        const configs = await this.connectors.listConfigs(req.user.sub);
        const configMap = new Map(configs.map((c) => [c.source, c]));

        const taskStatuses = available.map((source) => {
            const config = configMap.get(source);

            return {
                source,
                connected: config?.enabled ?? false,
                lastSynced: config?.lastSyncedAt?.toISOString(),
            };
        });

        const discordStatus = await this.discord.getStatus(req.user.sub);

        return [
            ...taskStatuses,
            { source: 'discord', connected: discordStatus.connected },
        ];
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
        const url =
            source === 'discord'
                ? this.discord.getAuthUrl(req.user.sub)
                : await this.connectors.getOAuthUrl({ userId: req.user.sub, source });

        return { url };
    }

    /** List Notion databases available to the authenticated user's integration. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List Notion databases for the connected integration' })
    @Get('notion/databases')
    @UseGuards(CombinedAuthGuard)
    async listNotionDatabases(
        @Request() req: AuthRequest,
    ): Promise<{ id: string; name: string }[]> {
        const tokens = await this.connectors.getDecryptedTokens({ userId: req.user.sub, source: 'notion' });
        const connector = this.registry.get('notion') as NotionConnector;

        return connector.listDatabases(tokens);
    }

    /** Return the connectionDetailsSchema for a connector, or {} if it has none. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get connection details schema for a connector' })
    @Get(':source/connection-schema')
    @UseGuards(CombinedAuthGuard)
    getConnectionSchema(@Param('source') source: string): ConnectionDetailsSchema {
        const connector = this.registry.get(source);

        return connector.connectionDetailsSchema ?? {};
    }

    /** Validate required fields against the connector's schema, then store in ConnectorConfig.settings. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Save connection details for a connector' })
    @Post(':source/connection-details')
    @UseGuards(CombinedAuthGuard)
    @HttpCode(200)
    async setConnectionDetails(
        @Request() req: AuthRequest,
        @Param('source') source: string,
        @Body() body: Record<string, unknown>,
    ): Promise<{ ok: boolean }> {
        const connector = this.registry.get(source);
        const schema = connector.connectionDetailsSchema ?? {};

        for (const [key, field] of Object.entries(schema)) {
            if (field.required && !body[key]) {
                throw new BadRequestException(`Missing required field: ${key}`);
            }
        }

        await this.connectors.update({
            configId: await this.connectors.getConfigIdBySource({ userId: req.user.sub, source }),
            userId: req.user.sub,
            patch: { settings: body },
        });

        return { ok: true };
    }

    /** Get the OAuth URL for a specific connector source. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get OAuth URL for a connector source' })
    @Get(':source/auth')
    @UseGuards(CombinedAuthGuard)
    async getOAuthUrlBySource(@Request() req: AuthRequest, @Param('source') source: string): Promise<{ url: string }> {
        this.logger.log(`getOAuthUrl source=${source} userId=${req.user.sub}`);

        const url =
            source === 'discord'
                ? this.discord.getAuthUrl(req.user.sub)
                : await this.connectors.getOAuthUrl({ userId: req.user.sub, source });

        this.logger.log(`getOAuthUrl url=${url}`);

        return { url };
    }

    /** Disconnect a connector by source name. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Disconnect a connector by source name' })
    @ApiResponse({ status: 204 })
    @Delete(':source')
    @UseGuards(CombinedAuthGuard)
    @HttpCode(204)
    async removeBySource(@Request() req: AuthRequest, @Param('source') source: string): Promise<void> {
        if (source === 'discord') {
            await this.discord.disconnect(req.user.sub);
        } else {
            await this.connectors.removeBySource({ source, userId: req.user.sub });
        }
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
        @Res() res: FastifyReply,
    ): Promise<void> {
        this.logger.log(`oauthCallback source=${source} state=${state} hasCode=${!!code}`);

        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        try {
            const { userId } = this.connectors.verifyState(state);

            if (source === 'discord') {
                await this.discord.handleCallback({ code, userId });
            } else {
                await this.connectors.handleCallback({ source, code, userId });
            }

            this.logger.log(`oauthCallback handleCallback done, redirecting to ${webUrl}/settings/sources`);

            const registeredConnector = source !== 'discord' ? this.registry.get(source) : null;
            const needsSetup = Object.keys(registeredConnector?.connectionDetailsSchema ?? {}).length > 0;
            const redirectQuery = needsSetup
                ? `connected=${source}&setup=required`
                : `connected=${source}`;

            await res.status(302).header('Location', `${webUrl}/settings/sources?${redirectQuery}`).send();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';

            this.logger.error(`oauthCallback failed: ${message}`);

            await res
                .status(302)
                .header('Location', `${webUrl}/settings/sources?error=${encodeURIComponent(message)}`)
                .send();
        }
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
