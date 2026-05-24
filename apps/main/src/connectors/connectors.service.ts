import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InternalError } from '@ctm/errors';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { ConnectorName, OAuthConnectorRegistry } from '@ctm/connectors';
import type { OAuthTokens } from '@ctm/connectors';
import { ConnectorConfig, type ConnectorConfigDocument } from './schemas/connector-config.schema.js';
import { EncryptionService } from './encryption.service.js';

type OAuthStatePayload = { sub: string };

@Injectable()
export class ConnectorsService {
    constructor(
        @InjectModel(ConnectorConfig.name) private readonly configModel: Model<ConnectorConfigDocument>,
        private readonly registry: OAuthConnectorRegistry,
        private readonly encryption: EncryptionService,
        private readonly jwt: JwtService,
    ) {}

    /** List all available connector source names. */
    listAvailable(): ConnectorName[] {
        return this.registry.list();
    }

    /** List the current user's connector configs. */
    async listConfigs(userId: string): Promise<ConnectorConfigDocument[]> {
        return this.configModel.find({ userId: new Types.ObjectId(userId) });
    }

    /** Get the OAuth authorization URL for a connector source. */
    async getOAuthUrl({ userId, source }: { userId: string; source: ConnectorName }): Promise<string> {
        const connector = this.registry.get(source);
        const state = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });

        return connector.getAuthUrl(state);
    }

    /** Verify an OAuth state JWT. Throws if invalid or expired. */
    verifyState(state: string): { userId: string } {
        try {
            const payload = this.jwt.verify<OAuthStatePayload>(state);
            return { userId: payload.sub };
        } catch {
            throw new UnauthorizedException('Invalid or expired OAuth state');
        }
    }

    /** Handle OAuth callback: exchange code, encrypt and upsert tokens. */
    async handleCallback({
        source,
        code,
        userId,
    }: {
        source: ConnectorName;
        code: string;
        userId: string;
    }): Promise<ConnectorConfigDocument> {
        const connector = this.registry.get(source);
        const tokens = await connector.exchangeCode(code);
        const extra = (await connector.resolveConnectionSettings?.(tokens)) ?? {};

        const doc = await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source },
            {
                ...extra,
                accessToken: this.encryption.encrypt(tokens.accessToken),
                refreshToken: this.encryption.encrypt(tokens.refreshToken),
                tokenExpiresAt: tokens.expiresAt,
                enabled: true,
                lastError: null,
            },
            { upsert: true, new: true },
        );

        if (!doc) throw new InternalError('Upsert failed unexpectedly');

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
    async removeBySource({ source, userId }: { source: ConnectorName; userId: string }): Promise<void> {
        const result = await this.configModel.deleteOne({ source, userId: new Types.ObjectId(userId) });

        if (result.deletedCount === 0) throw new NotFoundException('Connector config not found');
    }

    /** Get decrypted OAuthTokens for a user+source. Throws NotFoundException if not connected. */
    async getDecryptedTokens({ userId, source }: { userId: string; source: ConnectorName }): Promise<OAuthTokens> {
        const config = await this.configModel.findOne({ userId: new Types.ObjectId(userId), source });

        if (!config) throw new NotFoundException(`Not connected to ${source}`);

        return {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };
    }

    /**
     * Returns decrypted tokens for a user+source, refreshing them first if they
     * expire within 5 minutes. Persists updated tokens to the database on refresh.
     */
    async ensureFreshTokens({ userId, source }: { userId: string; source: ConnectorName }): Promise<OAuthTokens> {
        const config = await this.configModel.findOne({ userId: new Types.ObjectId(userId), source });

        if (!config) throw new NotFoundException(`Not connected to ${source}`);

        const tokens: OAuthTokens = {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };

        const msUntilExpiry = config.tokenExpiresAt.getTime() - Date.now();

        if (msUntilExpiry > 5 * 60 * 1000) {
            return tokens;
        }

        const connector = this.registry.get(source);
        const fresh = await connector.refreshToken(tokens);

        await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source },
            {
                accessToken: this.encryption.encrypt(fresh.accessToken),
                refreshToken: this.encryption.encrypt(fresh.refreshToken),
                tokenExpiresAt: fresh.expiresAt,
            },
        );

        return fresh;
    }

    /** Get the stored settings for a user+source connector. Returns empty object if not found. */
    async getSettings({ userId, source }: { userId: string; source: ConnectorName }): Promise<Record<string, unknown>> {
        const config = await this.configModel.findOne({ userId: new Types.ObjectId(userId), source });

        return config?.settings ?? {};
    }

    /** Get the config document ID for a user+source. Throws NotFoundException if not found. */
    async getConfigIdBySource({ userId, source }: { userId: string; source: ConnectorName }): Promise<string> {
        const config = await this.configModel.findOne({ userId: new Types.ObjectId(userId), source });

        if (!config) throw new NotFoundException(`Not connected to ${source}`);

        return String(config._id);
    }

    /** Update lastSyncedAt timestamp for a user+source connector config. */
    async updateLastSyncedAt({ userId, source }: { userId: string; source: ConnectorName }): Promise<void> {
        await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source },
            { lastSyncedAt: new Date() },
        );
    }
}
