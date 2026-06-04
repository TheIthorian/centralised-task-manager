import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import type { AuthorizedAppDto } from '@ctm/api-client';
import { RefreshToken, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';
import { OAuthClient, type OAuthClientDocument } from './schemas/oauth-client.schema.js';
import { ApiToken, type ApiTokenDocument } from './schemas/api-token.schema.js';


@Injectable()
export class AuthorizedAppsService {
    constructor(
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
        @InjectModel(OAuthClient.name) private readonly oauthClientModel: Model<OAuthClientDocument>,
        @InjectModel(ApiToken.name) private readonly apiTokenModel: Model<ApiTokenDocument>,
    ) {}

    /** List authorized OAuth clients and API tokens for the given user. */
    async getAuthorizedApps(userId: string): Promise<AuthorizedAppDto[]> {
        const tokens = await this.refreshTokenModel.find({
            userId,
            clientId: { $exists: true, $ne: null },
        });

        const latestByClient = new Map<string, RefreshTokenDocument>();

        for (const token of tokens) {
            if (!token.clientId) continue;

            const existing = latestByClient.get(token.clientId);

            if (!existing || token.createdAt > existing.createdAt) {
                latestByClient.set(token.clientId, token);
            }
        }

        const results: AuthorizedAppDto[] = [];

        for (const [clientId, token] of latestByClient) {
            const client = await this.oauthClientModel.findOne({ clientId });

            if (!client) continue;

            results.push({
                clientId,
                clientName: client.clientName,
                scopes: token.scopes,
                authorizedAt: token.createdAt.toISOString(),
                type: 'oauth',
            });
        }

        const apiTokens = await this.apiTokenModel.find({ userId: new Types.ObjectId(userId) });

        for (const token of apiTokens) {
            results.push({
                clientId: String(token._id),
                clientName: token.label,
                scopes: [],
                authorizedAt: token.createdAt.toISOString(),
                type: 'api-token',
            });
        }

        return results;
    }

    /**
     * Revoke a user's access to an OAuth client or API token.
     * OAuth dynamic clients: deletes the OAuthClient + all its refresh tokens.
     * OAuth static clients: deletes only this user's refresh tokens for that client.
     * API tokens: deletes the specific API token.
     */
    async revokeAuthorizedApp({ userId, clientId }: { userId: string; clientId: string }): Promise<void> {
        const oauthClient = await this.oauthClientModel.findOne({ clientId });

        if (oauthClient) {
            if (oauthClient.isDynamic) {
                await this.oauthClientModel.deleteOne({ clientId });
                await this.refreshTokenModel.deleteMany({ clientId });
            } else {
                await this.refreshTokenModel.deleteMany({ userId, clientId });
            }

            return;
        }

        if (isValidObjectId(clientId)) {
            const result = await this.apiTokenModel.deleteOne({ _id: clientId, userId: new Types.ObjectId(userId) });

            if (result.deletedCount > 0) return;
        }

        throw new NotFoundException(`Authorized app ${clientId} not found`);
    }
}
