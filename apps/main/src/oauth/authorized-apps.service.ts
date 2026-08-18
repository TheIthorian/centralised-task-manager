import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundError } from '@ctm/errors';
import type { AuthorizedAppDto } from '@ctm/api-client';
import { RefreshTokenService } from '../tokens/refresh-token.service.js';
import {
    AuthorizedClient,
    type AuthorizedClientDocument,
    OAuthClient,
    type OAuthClientDocument,
    OAuthClientRegistration,
} from '@ctm/db';
import { clientLogoPath } from './client-logo.service.js';
import { ClientTrustService } from './client-trust.service.js';

@Injectable()
export class AuthorizedAppsService {
    constructor(
        @InjectModel(OAuthClient.name) private readonly oauthClientModel: Model<OAuthClientDocument>,
        @InjectModel(AuthorizedClient.name)
        private readonly authorizedClientModel: Model<AuthorizedClientDocument>,
        private readonly refreshTokens: RefreshTokenService,
        private readonly trust: ClientTrustService,
    ) {}

    /** List OAuth clients the given user has authorized. */
    async getAuthorizedApps(userId: string): Promise<AuthorizedAppDto[]> {
        const authorizations = await this.authorizedClientModel.find({ userId }).sort({ authorizedAt: -1 });

        if (authorizations.length === 0) return [];

        const clients = await this.oauthClientModel
            .find({
                clientId: { $in: authorizations.map((authorization) => authorization.clientId) },
            })
            // The bytes are served from their own endpoint; this list only needs to know one exists.
            .select('-logo.data');

        const clientsById = new Map(clients.map((client) => [client.clientId, client]));
        const results: AuthorizedAppDto[] = [];

        for (const authorization of authorizations) {
            const client = clientsById.get(authorization.clientId);

            // A grant whose client has been deleted or TTL-reaped is not something the user can act on.
            if (!client) continue;

            results.push({
                clientId: authorization.clientId,
                clientName: client.clientName,
                scopes: authorization.scopes,
                authorizedAt: authorization.authorizedAt.toISOString(),
                type: 'oauth',
                logoPath: client.logo ? clientLogoPath(client.clientId) : undefined,
                clientUri: client.clientUri,
                tosUri: client.tosUri,
                policyUri: client.policyUri,
                contacts: client.contacts,
                softwareId: client.softwareId,
                isVerified: this.trust.isVerified(client),
            });
        }

        return results;
    }

    /**
     * Revoke a user's access to an OAuth client.
     *
     * A self-registered client exists only because it registered, so the last user to revoke it
     * takes the client with them: the record, every grant and every refresh token. Any other
     * client outlives the grant — a first-party client is seeded at boot, and a metadata document
     * is a shared cache of something the client publishes — so revoking removes this user's grant
     * and refresh tokens and nothing else.
     */
    async revokeAuthorizedApp({ userId, clientId }: { userId: string; clientId: string }): Promise<void> {
        const oauthClient = await this.oauthClientModel.findOne({ clientId });
        const authorization = await this.authorizedClientModel.findOne({ userId, clientId });

        if (!oauthClient && !authorization) throw new NotFoundError(`Authorized app ${clientId}`);

        // The client document is the source of truth while it exists. A dynamic client can be
        // TTL-reaped out from under a grant, and then the grant's own snapshot decides.
        const registrationType = oauthClient
            ? oauthClient.registrationType
            : (authorization?.registrationType ?? OAuthClientRegistration.Dynamic);

        if (registrationType === OAuthClientRegistration.Dynamic) {
            await this.oauthClientModel.deleteOne({ clientId });
            await this.authorizedClientModel.deleteMany({ clientId });
            await this.refreshTokens.revokeAllForClient(clientId);

            return;
        }

        await this.authorizedClientModel.deleteOne({ userId, clientId });
        await this.refreshTokens.revokeForUserAndClient({ userId, clientId });
    }
}
