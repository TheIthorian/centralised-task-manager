import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for AuthorizedClient. */
export type AuthorizedClientDocument = HydratedDocument<AuthorizedClient>;

/**
 * An explicit record that a user granted an OAuth client access. Outlives the tokens the grant
 * produced, so the authorized apps list survives refresh token expiry.
 */
@Schema({ timestamps: true })
export class AuthorizedClient {
    @Prop({ type: String, required: true, index: true })
    userId!: string;

    /** `OAuthClient.clientId`, not a Mongo `_id`. */
    @Prop({ type: String, required: true, index: true })
    clientId!: string;

    @Prop({ type: [String], default: [] })
    scopes!: string[];

    /**
     * Snapshot of the client's registration kind at grant time. Duplicated from `OAuthClient`
     * because a dynamic client can be reaped by its TTL index while this link is still readable.
     */
    @Prop({ type: Boolean, default: true })
    isDynamic!: boolean;

    /** When the user first granted this client. Not moved by later re-authorizations. */
    @Prop({ type: Date, required: true })
    authorizedAt!: Date;
}

export const AuthorizedClientSchema = SchemaFactory.createForClass(AuthorizedClient);

// One grant per user + client: makes re-authorization an idempotent upsert rather than a new row.
AuthorizedClientSchema.index({ userId: 1, clientId: 1 }, { unique: true });
