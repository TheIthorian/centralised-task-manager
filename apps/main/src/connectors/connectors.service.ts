import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConnectorRegistry } from '@ctm/connectors';
import type { OAuthTokens } from '@ctm/connectors';
import { ConnectorConfig, type ConnectorConfigDocument } from './schemas/connector-config.schema.js';
import { EncryptionService } from './encryption.service.js';

@Injectable()
export class ConnectorsService {
    constructor(
        @InjectModel(ConnectorConfig.name) private readonly configModel: Model<ConnectorConfigDocument>,
        private readonly registry: ConnectorRegistry,
        private readonly encryption: EncryptionService,
    ) {}

    /** List all available connector source names. */
    listAvailable(): string[] {
        return this.registry.list();
    }

    /** List the current user's connector configs (tokens excluded). */
    async listConfigs(userId: string): Promise<ConnectorConfigDocument[]> {
        return this.configModel.find({ userId: new Types.ObjectId(userId) });
    }

    /** Get the OAuth authorization URL for a connector source. */
    async getOAuthUrl({ userId, source }: { userId: string; source: string }): Promise<string> {
        const connector = this.registry.get(source);

        return connector.getAuthUrl(userId);
    }

    /** Handle OAuth callback: exchange code, encrypt and upsert tokens. */
    async handleCallback({
        source,
        code,
        userId,
    }: {
        source: string;
        code: string;
        userId: string;
    }): Promise<ConnectorConfigDocument> {
        const connector = this.registry.get(source);
        const tokens = await connector.exchangeCode(code);
        const doc = await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source },
            {
                accessToken: this.encryption.encrypt(tokens.accessToken),
                refreshToken: this.encryption.encrypt(tokens.refreshToken),
                tokenExpiresAt: tokens.expiresAt,
                enabled: true,
                lastError: null,
            },
            { upsert: true, new: true },
        );

        if (!doc) throw new Error('Upsert failed unexpectedly');

        return doc;
    }

    /** Update a connector config's settings or enabled state. */
    async update({
        configId,
        userId,
        patch,
    }: {
        configId: string;
        userId: string;
        patch: { enabled?: boolean; settings?: Record<string, unknown> };
    }): Promise<ConnectorConfigDocument> {
        const doc = await this.configModel.findOneAndUpdate(
            { _id: configId, userId: new Types.ObjectId(userId) },
            patch,
            { new: true },
        );

        if (!doc) throw new NotFoundException('Connector config not found');

        return doc;
    }

    /** Remove a connector config by source name. */
    async removeBySource({ source, userId }: { source: string; userId: string }): Promise<void> {
        const result = await this.configModel.deleteOne({ source, userId: new Types.ObjectId(userId) });

        if (result.deletedCount === 0) throw new NotFoundException('Connector config not found');
    }

    /** Remove a connector config and all synced tasks for that user+source. */
    async remove({ configId, userId }: { configId: string; userId: string }): Promise<void> {
        const result = await this.configModel.deleteOne({ _id: configId, userId: new Types.ObjectId(userId) });

        if (result.deletedCount === 0) throw new NotFoundException('Connector config not found');
    }

    /** Get decrypted OAuthTokens for a user+source. Throws NotFoundException if not connected. */
    async getDecryptedTokens({ userId, source }: { userId: string; source: string }): Promise<OAuthTokens> {
        const config = await this.configModel.findOne({ userId: new Types.ObjectId(userId), source });

        if (!config) throw new NotFoundException(`Not connected to ${source}`);

        return {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };
    }
}
