import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthorizedClient, type AuthorizedClientDocument } from './schemas/authorized-client.schema.js';

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
        isDynamic,
    }: {
        userId: string;
        clientId: string;
        scopes: string[];
        isDynamic: boolean;
    }): Promise<void> {
        await this.authorizedClientModel.updateOne(
            { userId, clientId },
            {
                $set: { scopes, isDynamic },
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
