import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthorizedClient, type AuthorizedClientDocument, type OAuthClientRegistration } from '@ctm/db';

/** Reads and writes the explicit user to OAuth client grant records. */
@Injectable()
export class AuthorizedClientService {
    constructor(
        @InjectModel(AuthorizedClient.name)
        private readonly authorizedClientModel: Model<AuthorizedClientDocument>,
    ) {}

    /**
     * Record that a user granted a client access, or refresh the scopes of an existing grant.
     * `authorizedAt` is only written on insert, so it keeps meaning "first granted".
     */
    async recordAuthorization({
        userId,
        clientId,
        scopes,
        registrationType,
    }: {
        userId: string;
        clientId: string;
        scopes: string[];
        registrationType: OAuthClientRegistration;
    }): Promise<void> {
        await this.authorizedClientModel.updateOne(
            { userId, clientId },
            {
                $set: { scopes, registrationType },
                $setOnInsert: { authorizedAt: new Date() },
            },
            { upsert: true },
        );
    }

    /** Every grant the given user has made, newest first. */
    async findByUser(userId: string): Promise<AuthorizedClientDocument[]> {
        return this.authorizedClientModel.find({ userId }).sort({ authorizedAt: -1 });
    }
}
