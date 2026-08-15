import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '@ctm/errors';
import type {
    AdminOAuthClientDto,
    AdminOAuthClientPageDto,
    CreateOAuthClientDto,
    UpdateOAuthClientDto,
} from '@ctm/api-client';
import { OAuthClient, SCOPE_REGISTRY, type OAuthClientDocument } from '@ctm/db';

@Injectable()
export class OAuthClientsService {
    constructor(@InjectModel(OAuthClient.name) private readonly model: Model<OAuthClientDocument>) {}

    /** List registered clients, newest first. */
    async list({
        limit,
        skip,
        isDynamic,
        search,
    }: {
        limit: number;
        skip: number;
        isDynamic?: boolean;
        search?: string;
    }): Promise<AdminOAuthClientPageDto> {
        const filter: Record<string, unknown> = {};

        if (isDynamic !== undefined) filter['isDynamic'] = isDynamic;

        if (search) {
            const pattern = { $regex: escapeRegExp(search), $options: 'i' };

            filter['$or'] = [{ clientName: pattern }, { clientId: pattern }];
        }

        const [clients, total] = await Promise.all([
            this.model.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit),
            this.model.countDocuments(filter),
        ]);

        return { clients: clients.map(toClientDto), total };
    }

    /**
     * Read one client.
     *
     * @throws NotFoundError when no client has that id.
     */
    async findOne(clientId: string): Promise<AdminOAuthClientDto> {
        return toClientDto(await this.requireClient(clientId));
    }

    /**
     * Register a client from the admin UI rather than through RFC 7591.
     *
     * @throws ValidationError when a requested scope is not in the registry.
     */
    async create(dto: CreateOAuthClientDto): Promise<AdminOAuthClientDto> {
        assertKnownScopes(dto.scopes);

        const created = await this.model.create({
            clientId: `ctm-${randomBytes(16).toString('hex')}`,
            clientName: dto.clientName,
            redirectUris: dto.redirectUris,
            scopes: dto.scopes,
            grantTypes: dto.grantTypes ?? ['authorization_code', 'refresh_token'],
            responseTypes: dto.responseTypes ?? ['code'],
            // Operator-created, so not the product of dynamic registration; but unlike a
            // code-seeded client it is data, and stays editable here.
            isDynamic: true,
            clientUri: dto.clientUri,
            tosUri: dto.tosUri,
            policyUri: dto.policyUri,
            contacts: dto.contacts,
            issuedAt: new Date(),
        });

        return toClientDto(created);
    }

    /**
     * Change a client's configuration.
     *
     * @throws NotFoundError when no client has that id.
     * @throws ConflictError when the client is seeded from code.
     * @throws ValidationError when a requested scope is not in the registry.
     */
    async update({ clientId, dto }: { clientId: string; dto: UpdateOAuthClientDto }): Promise<AdminOAuthClientDto> {
        const client = await this.requireClient(clientId);

        assertEditable(client);

        if (dto.scopes) assertKnownScopes(dto.scopes);

        // Explicit null clears an optional display field; an absent key leaves it alone.
        const set: Record<string, unknown> = {};
        const unset: Record<string, ''> = {};

        for (const [key, value] of Object.entries(dto)) {
            if (value === null) unset[key] = '';
            else if (value !== undefined) set[key] = value;
        }

        const updated = await this.model.findOneAndUpdate(
            { clientId },
            {
                ...(Object.keys(set).length > 0 && { $set: set }),
                ...(Object.keys(unset).length > 0 && { $unset: unset }),
            },
            { returnDocument: 'after' },
        );

        if (!updated) throw new NotFoundError(`OAuth client ${clientId}`);

        return toClientDto(updated);
    }

    /**
     * Remove a client, so it can no longer complete an authorization.
     *
     * @throws NotFoundError when no client has that id.
     * @throws ConflictError when the client is seeded from code.
     */
    async revoke(clientId: string): Promise<AdminOAuthClientDto> {
        const client = await this.requireClient(clientId);

        assertEditable(client);

        await this.model.deleteOne({ clientId });

        return toClientDto(client);
    }

    private async requireClient(clientId: string): Promise<OAuthClientDocument> {
        const client = await this.model.findOne({ clientId });

        if (!client) throw new NotFoundError(`OAuth client ${clientId}`);

        return client;
    }
}

function toClientDto(client: OAuthClientDocument): AdminOAuthClientDto {
    return {
        clientId: client.clientId,
        clientName: client.clientName,
        redirectUris: client.redirectUris,
        grantTypes: client.grantTypes,
        responseTypes: client.responseTypes,
        scopes: client.scopes,
        isDynamic: client.isDynamic,
        clientUri: client.clientUri ?? null,
        tosUri: client.tosUri ?? null,
        policyUri: client.policyUri ?? null,
        contacts: client.contacts ?? [],
        softwareId: client.softwareId ?? null,
        issuedAt: client.issuedAt.toISOString(),
        lastUsedAt: client.lastUsedAt?.toISOString() ?? null,
    };
}

// `isDynamic: false` is set only by the boot-time seeding in apps/main, which re-applies its
// definition on every start. Editing one here would be reverted by the next deploy, and the client
// would be broken in the meantime, so the write is refused rather than silently undone later.
function assertEditable(client: OAuthClientDocument): void {
    if (!client.isDynamic) {
        throw new ConflictError(
            `OAuth client ${client.clientId} is seeded from code and is managed by the deployment, not the admin API`,
        );
    }
}

function assertKnownScopes(scopes: string[]): void {
    const unknown = scopes.filter((scope) => !(scope in SCOPE_REGISTRY));

    if (unknown.length > 0) {
        throw new ValidationError(`Unknown scopes: ${unknown.join(', ')}`);
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
