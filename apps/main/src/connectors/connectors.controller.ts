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
import { ConnectorName, TaskConnectorName, OAuthConnectorRegistry, ExternalTaskSourceRegistry } from '@ctm/connectors';
import Ajv from 'ajv';
import type { NotionTaskSource } from '@ctm/connectors';
import type {
    ConnectorAuthUrlDto,
    ConnectorHealthDto,
    ConnectorStatusDto,
    NotionDatabaseDto,
    OkDto,
    UpdateConnectorResponseDto,
} from '@ctm/api-client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ConnectorsService } from './connectors.service.js';
import { UpdateConnectorDto } from './dto/update-connector.dto.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Connectors')
@Controller('connectors')
export class ConnectorsController {
    private readonly logger = new Logger(ConnectorsController.name);
    private readonly ajv = new Ajv();

    constructor(
        private readonly connectors: ConnectorsService,
        private readonly oAuthConnectorRegistry: OAuthConnectorRegistry,
        private readonly externalTaskSourceRegistry: ExternalTaskSourceRegistry,
        private readonly config: ConfigService,
    ) {}

    /** List connectors with connection state for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List connectors for the current user' })
    @Get()
    @UseGuards(JwtAuthGuard)
    async listConnectors(@Request() req: AuthRequest): Promise<ConnectorStatusDto[]> {
        const available = this.connectors.listAvailable();
        const configs = await this.connectors.listConfigs(req.user.sub);
        const configMap = new Map(configs.map((c) => [c.source, c]));

        return available.map((connectorName) => {
            const config = configMap.get(connectorName);
            const connector = this.oAuthConnectorRegistry.get(connectorName);
            const connected = config?.enabled ?? false;

            const setupRequired =
                connected &&
                Object.entries(connector.connectionDetailsSchema)
                    .filter(([, v]) => v.inputDefinition.required)
                    .map(([k]) => k as keyof typeof connector.connectionDetailsSchema)
                    .some((k) => !(config!.settings as Record<string, unknown>)[k]);

            return {
                source: connectorName,
                connected,
                lastSynced: config?.lastSyncedAt?.toISOString(),
                connectorType: connector.connectorType,
                connectionSchema: connector.connectionDetailsSchema,
                setupRequired,
            };
        });
    }

    /** Health-check all connected task-sync connectors for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Health-check connected task-sync connectors' })
    @Get('health')
    @UseGuards(JwtAuthGuard)
    async checkHealth(@Request() req: AuthRequest): Promise<ConnectorHealthDto[]> {
        const configs = await this.connectors.listConfigs(req.user.sub);

        const results = await Promise.allSettled(
            configs.map(async (config) => {
                const connector = this.oAuthConnectorRegistry.get(config.source);
                const tokens = await this.connectors.ensureFreshTokens({ userId: req.user.sub, source: config.source });
                return await connector.healthCheck(tokens);
            }),
        );

        return results.map((result, i) => {
            if (result.status === 'fulfilled') return result.value;
            const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
            return { source: configs[i]!.source, healthy: false, error: message };
        });
    }

    /** List Notion databases available to the authenticated user's integration. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'List Notion databases for the connected integration' })
    @Get('notion/databases')
    @UseGuards(JwtAuthGuard)
    async listNotionDatabases(@Request() req: AuthRequest): Promise<NotionDatabaseDto[]> {
        const tokens = await this.connectors.getDecryptedTokens({ userId: req.user.sub, source: ConnectorName.Notion });
        const connector = this.externalTaskSourceRegistry.get(TaskConnectorName.Notion) as NotionTaskSource;
        return connector.listDatabases(tokens);
    }

    /** Validate required fields against the connector's schema, then store in ConnectorConfig.settings. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Save connection details for a connector' })
    @Post(':connectorName/connection-details')
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    async setConnectionDetails(
        @Request() req: AuthRequest,
        @Param('connectorName') connectorName: ConnectorName,
        @Body() body: Record<string, unknown>,
    ): Promise<OkDto> {
        const connector = this.oAuthConnectorRegistry.get(connectorName);
        const schema = connector.connectionDetailsSchema;

        if (Object.keys(schema).length > 0) {
            const ajvSchema = {
                type: 'object',
                properties: Object.fromEntries(
                    Object.entries(schema).map(([key, field]) => [key, field.validationSchema]),
                ),
                required: Object.entries(schema)
                    .filter(([, f]) => f.inputDefinition.required)
                    .map(([k]) => k),
                additionalProperties: false,
            };

            const validate = this.ajv.compile(ajvSchema);

            if (!validate(body)) {
                const message = this.ajv.errorsText(validate.errors);
                throw new BadRequestException(`Invalid connection details: ${message}`);
            }
        }

        await this.connectors.update({
            configId: await this.connectors.getConfigIdBySource({ userId: req.user.sub, source: connectorName }),
            userId: req.user.sub,
            patch: { settings: body },
        });

        return { ok: true };
    }

    /** Get the OAuth URL for a connector. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get OAuth URL for a connector' })
    @Get(':connectorName/auth')
    @UseGuards(JwtAuthGuard)
    async getOAuthUrl(
        @Request() req: AuthRequest,
        @Param('connectorName') connectorName: ConnectorName,
    ): Promise<ConnectorAuthUrlDto> {
        const url = await this.connectors.getOAuthUrl({ userId: req.user.sub, source: connectorName });
        return { url };
    }

    /** Disconnect a connector. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Disconnect a connector' })
    @ApiResponse({ status: 204 })
    @Delete(':connectorName')
    @UseGuards(JwtAuthGuard)
    @HttpCode(204)
    async removeByConnectorName(
        @Request() req: AuthRequest,
        @Param('connectorName') connectorName: ConnectorName,
    ): Promise<void> {
        await this.connectors.removeBySource({ source: connectorName, userId: req.user.sub });
    }

    /** OAuth callback — called by the provider after user grants access. */
    @ApiOperation({
        summary: 'OAuth callback (called by provider)',
        description: 'This endpoint is called by the external provider after the user grants access.',
    })
    @Get('oauth/callback/:connectorName')
    async oauthCallback(
        @Param('connectorName') connectorName: ConnectorName,
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        this.logger.log(`oauthCallback connectorName=${connectorName} state=${state} hasCode=${!!code}`);

        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        try {
            const { userId } = this.connectors.verifyState(state);

            await this.connectors.handleCallback({ source: connectorName, code, userId });

            this.logger.log(`oauthCallback handleCallback done, redirecting to ${webUrl}/settings/sources`);

            const connector = this.oAuthConnectorRegistry.get(connectorName);
            const needsSetup = Object.keys(connector.connectionDetailsSchema).length > 0;
            const redirectQuery = needsSetup
                ? `connected=${connectorName}&setup=required`
                : `connected=${connectorName}`;

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
    @UseGuards(JwtAuthGuard)
    async update(
        @Request() req: AuthRequest,
        @Param('id') id: string,
        @Body() dto: UpdateConnectorDto,
    ): Promise<UpdateConnectorResponseDto> {
        const doc = await this.connectors.update({ configId: id, userId: req.user.sub, patch: dto });
        return { id: String(doc._id), enabled: doc.enabled };
    }
}
