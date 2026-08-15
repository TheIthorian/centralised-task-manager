import { Controller, Delete, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type {
    AdminOAuthClientDto,
    AdminOAuthClientPageDto,
    AvailableScopeDto,
} from '@ctm/api-client';
import { AuditAction, AuditTargetType, SCOPE_REGISTRY } from '@ctm/db';
import { UnvalidatedInput, ValidatedBody, ValidatedParam, ValidatedQuery } from '@ctm/nest-common';
import { AuditService } from '../audit/audit.service.js';
import type { AdminRequest } from '../auth/admin.guard.js';
import { OAuthClientsService } from './oauth-clients.service.js';
import {
    CreateOAuthClientDto,
    ListOAuthClientsQueryDto,
    UpdateOAuthClientDto,
} from './dto/oauth-client.dto.js';

const clientIdSchema = z.string().min(1).max(200);

@Controller('oauth-clients')
export class OAuthClientsController {
    constructor(
        private readonly clients: OAuthClientsService,
        private readonly audit: AuditService,
    ) {}

    /** List registered clients, newest first. */
    @Get()
    list(@ValidatedQuery(ListOAuthClientsQueryDto) query: ListOAuthClientsQueryDto): Promise<AdminOAuthClientPageDto> {
        return this.clients.list(query);
    }

    /** The scopes an operator may grant, for populating the client editor. */
    @Get('available-scopes')
    @UnvalidatedInput('Takes no arguments.')
    availableScopes(): AvailableScopeDto[] {
        return Object.values(SCOPE_REGISTRY);
    }

    /** Read one client. */
    @Get(':clientId')
    findOne(@ValidatedParam({ name: 'clientId', schema: clientIdSchema }) clientId: string): Promise<AdminOAuthClientDto> {
        return this.clients.findOne(clientId);
    }

    /** Register a client from the admin UI rather than through dynamic registration. */
    @Post()
    async create(
        @ValidatedBody(CreateOAuthClientDto) dto: CreateOAuthClientDto,
        @Req() request: AdminRequest,
    ): Promise<AdminOAuthClientDto> {
        const client = await this.clients.create(dto);

        await this.recordChange({ action: AuditAction.OAuthClientCreated, client, request });

        return client;
    }

    /** Change a client's configuration. */
    @Patch(':clientId')
    async update(
        @ValidatedParam({ name: 'clientId', schema: clientIdSchema }) clientId: string,
        @ValidatedBody(UpdateOAuthClientDto) dto: UpdateOAuthClientDto,
        @Req() request: AdminRequest,
    ): Promise<AdminOAuthClientDto> {
        const client = await this.clients.update({ clientId, dto });

        await this.recordChange({
            action: AuditAction.OAuthClientUpdated,
            client,
            request,
            metadata: { changed: Object.keys(dto) },
        });

        return client;
    }

    /** Remove a client, so it can no longer complete an authorization. */
    @Delete(':clientId')
    @HttpCode(200)
    async revoke(
        @ValidatedParam({ name: 'clientId', schema: clientIdSchema }) clientId: string,
        @Req() request: AdminRequest,
    ): Promise<AdminOAuthClientDto> {
        const client = await this.clients.revoke(clientId);

        await this.recordChange({ action: AuditAction.OAuthClientRevoked, client, request });

        return client;
    }

    private recordChange({
        action,
        client,
        request,
        metadata = {},
    }: {
        action: AuditAction;
        client: AdminOAuthClientDto;
        request: AdminRequest;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        return this.audit.record({
            action,
            actor: request.operator.email,
            targetType: AuditTargetType.OAuthClient,
            targetId: client.clientId,
            targetLabel: client.clientName,
            ip: request.ip ?? null,
            metadata,
        });
    }
}
