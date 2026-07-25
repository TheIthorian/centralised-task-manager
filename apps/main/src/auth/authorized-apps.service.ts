import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthorizedAppDto } from '@ctm/api-client';
import { RefreshToken, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';
import { OAuthClient, type OAuthClientDocument } from './schemas/oauth-client.schema.js';

@Injectable()
export class AuthorizedAppsService {
    constructor(
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
        @InjectModel(OAuthClient.name) private readonly oauthClientModel: Model<OAuthClientDocument>,
    ) {}

    /** List OAuth clients the given user has authorized. */
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

        return results;
    }

    /**
     * Revoke a user's access to an OAuth client.
     * OAuth dynamic clients: deletes the OAuthClient + all its refresh tokens.
     * OAuth static clients: deletes only this user's refresh tokens for that client.
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

        throw new NotFoundException(`Authorized app ${clientId} not found`);
    }
}
