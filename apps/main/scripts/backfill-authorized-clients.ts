import 'reflect-metadata';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ValidationError } from '@ctm/errors';
import { AuthorizedClient, AuthorizedClientSchema } from '../src/auth/schemas/authorized-client.schema.js';
import { OAuthClient, OAuthClientSchema } from '../src/auth/schemas/oauth-client.schema.js';
import { RefreshToken, RefreshTokenSchema } from '../src/auth/schemas/refresh-token.schema.js';

const grantSchema = z.object({
    _id: z.object({
        userId: z.string(),
        clientId: z.string(),
    }),
    scopes: z.array(z.string()).default([]),
    authorizedAt: z.date(),
});

/**
 * Backfill `authorizedclients` from the refresh tokens that currently imply the same grants.
 * Idempotent: re-running never duplicates a grant and never moves an existing `authorizedAt`.
 */
async function backfill(): Promise<void> {
    const uri = process.env['MONGODB_URI'];

    if (!uri) throw new ValidationError('MONGODB_URI is not set');

    await mongoose.connect(uri);

    const refreshTokenModel = mongoose.model(RefreshToken.name, RefreshTokenSchema);
    const oauthClientModel = mongoose.model(OAuthClient.name, OAuthClientSchema);
    const authorizedClientModel = mongoose.model(AuthorizedClient.name, AuthorizedClientSchema);

    await authorizedClientModel.syncIndexes();

    const rows = await refreshTokenModel.aggregate([
        { $match: { clientId: { $exists: true, $ne: null } } },
        // Newest token first, so $first below preserves the latest grant per user + client.
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: { userId: '$userId', clientId: '$clientId' },
                scopes: { $first: '$scopes' },
                authorizedAt: { $first: '$createdAt' },
            },
        },
    ]);

    const grants = z.array(grantSchema).parse(rows);

    if (grants.length === 0) {
        console.info('backfill-authorized-clients: no refresh tokens carry a client_id, nothing to do');
        await mongoose.disconnect();

        return;
    }

    const clientIds = [...new Set(grants.map((grant) => grant._id.clientId))];
    const clients = await oauthClientModel.find({ clientId: { $in: clientIds } }).select('clientId isDynamic');
    const isDynamicById = new Map(clients.map((client) => [client.clientId, client.isDynamic]));

    const result = await authorizedClientModel.bulkWrite(
        grants.map((grant) => ({
            updateOne: {
                filter: { userId: grant._id.userId, clientId: grant._id.clientId },
                update: {
                    $set: {
                        scopes: grant.scopes,
                        isDynamic: isDynamicById.get(grant._id.clientId) ?? true,
                    },
                    $setOnInsert: { authorizedAt: grant.authorizedAt },
                },
                upsert: true,
            },
        })),
    );

    console.info(
        `backfill-authorized-clients: ${grants.length} grants found, ${result.upsertedCount} inserted, ${result.modifiedCount} refreshed`,
    );

    await mongoose.disconnect();
}

void backfill();
