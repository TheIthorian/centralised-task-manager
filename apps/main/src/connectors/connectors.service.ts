import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InternalError, QuotaExceededError } from '@ctm/errors';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { ConnectorName, OAuthConnectorRegistry } from '@ctm/connectors';
import type { OAuthTokens } from '@ctm/connectors';
import { ConnectorConfig, type ConnectorConfigDocument } from './schemas/connector-config.schema.js';
import { EncryptionService } from './encryption.service.js';
import { MAX_CONNECTIONS_PER_CONNECTOR } from '../config/limits.js';

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

    /** Handle OAuth callback: exchange code, resolve account identity, encrypt and upsert tokens per account. */
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
        const identity = await connector.resolveAccountIdentity(tokens);
        const extra = (await connector.resolveConnectionSettings?.(tokens)) ?? {};

        await this.assertConnectionAllowed({ userId, source, externalAccountId: identity.externalAccountId });

        const doc = await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source, externalAccountId: identity.externalAccountId },
            {
                ...extra,
                externalAccountId: identity.externalAccountId,
                email: identity.email ?? null,
                label: identity.label ?? null,
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

    /**
     * Guard the per-source connection cap. Reconnecting an account that is already linked
     * is always allowed — only adding a new account can push a user over the limit.
     */
    private async assertConnectionAllowed({
        userId,
        source,
        externalAccountId,
    }: {
        userId: string;
        source: ConnectorName;
        externalAccountId: string;
    }): Promise<void> {
        const existing = await this.configModel.findOne({
            userId: new Types.ObjectId(userId),
            source,
            externalAccountId,
        });

        if (existing) return;

        const count = await this.configModel.countDocuments({ userId: new Types.ObjectId(userId), source });

        if (count >= MAX_CONNECTIONS_PER_CONNECTOR) {
            throw new QuotaExceededError(
                `You can connect at most ${MAX_CONNECTIONS_PER_CONNECTOR} ${source} accounts. Remove one first.`,
            );
        }
    }

    /** List all of a user's connection rows for one source. */
    async listConnectionsForSource({
        userId,
        source,
    }: {
        userId: string;
        source: ConnectorName;
    }): Promise<ConnectorConfigDocument[]> {
        return this.configModel.find({ userId: new Types.ObjectId(userId), source });
    }

    /** Load a single connection by id, scoped to the user. Throws if not found. */
    private async getConnection({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<ConnectorConfigDocument> {
        const doc = await this.configModel.findOne({
            _id: connectionId,
            userId: new Types.ObjectId(userId),
        });

        if (!doc) throw new NotFoundException('Connection not found');

        return doc;
    }

    /** Load a single connection by id (public wrapper for sync). Throws if not found. */
    async getConnectionForSync({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<ConnectorConfigDocument> {
        return this.getConnection({ userId, connectionId });
    }

    /** Get the source name for a connection. Throws if not found. */
    async getConnectionSource({ userId, connectionId }: { userId: string; connectionId: string }): Promise<string> {
        const doc = await this.getConnection({ userId, connectionId });

        return doc.source;
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

    /** Remove a single connection by id. */
    async removeConnection({ userId, connectionId }: { userId: string; connectionId: string }): Promise<void> {
        const result = await this.configModel.deleteOne({
            _id: connectionId,
            userId: new Types.ObjectId(userId),
        });

        if (result.deletedCount === 0) throw new NotFoundException('Connection not found');
    }

    /** Get decrypted OAuthTokens for a connection. Throws NotFoundException if not connected. */
    async getDecryptedTokens({ userId, connectionId }: { userId: string; connectionId: string }): Promise<OAuthTokens> {
        const config = await this.getConnection({ userId, connectionId });

        return {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };
    }

    /**
     * Returns decrypted tokens for a connection, refreshing them first if they
     * expire within 5 minutes. Persists updated tokens to the database on refresh.
     */
    async ensureFreshTokens({ userId, connectionId }: { userId: string; connectionId: string }): Promise<OAuthTokens> {
        const config = await this.getConnection({ userId, connectionId });

        const tokens: OAuthTokens = {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };

        const msUntilExpiry = config.tokenExpiresAt.getTime() - Date.now();

        if (msUntilExpiry > 5 * 60 * 1000) {
            return tokens;
        }

        const connector = this.registry.get(config.source as ConnectorName);
        const fresh = await connector.refreshToken(tokens);

        await this.configModel.findByIdAndUpdate(connectionId, {
            accessToken: this.encryption.encrypt(fresh.accessToken),
            refreshToken: this.encryption.encrypt(fresh.refreshToken),
            tokenExpiresAt: fresh.expiresAt,
        });

        return fresh;
    }

    /** Get the stored settings for a connection. Returns empty object if not found. */
    async getSettings({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<Record<string, unknown>> {
        const config = await this.getConnection({ userId, connectionId });

        return config.settings ?? {};
    }

    /** Update lastSyncedAt timestamp for a connection. */
    async updateLastSyncedAt({ userId, connectionId }: { userId: string; connectionId: string }): Promise<void> {
        await this.configModel.findOneAndUpdate(
            { _id: connectionId, userId: new Types.ObjectId(userId) },
            { lastSyncedAt: new Date() },
        );
    }
}
