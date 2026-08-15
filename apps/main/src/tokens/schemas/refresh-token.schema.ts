import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for RefreshToken. */
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

/** Which flow issued the token: a first-party login, or an OAuth authorization grant. */
export enum RefreshTokenGrant {
    Session = 'session',
    OAuth = 'oauth',
}

@Schema({ timestamps: true })
export class RefreshToken {
    @Prop({ type: String, required: true, index: true })
    tokenHash!: string;

    // Both flows mint indistinguishable `rt_<hex>` strings into this one collection, so the
    // grant is what stops a token being redeemed at the endpoint that did not issue it.
    @Prop({ type: String, required: true, enum: Object.values(RefreshTokenGrant), index: true })
    grant!: RefreshTokenGrant;

    @Prop({ type: String, required: true, index: true })
    userId!: string;

    // `FIRST_PARTY_CLIENT` for a session grant, a registered client id for an OAuth grant. Always
    // set, so a token can be attributed and revoked by client without a presence check.
    @Prop({ type: String, required: true, index: true })
    clientId!: string;

    @Prop({ type: [String], default: [] })
    scopes!: string[];

    @Prop({ type: Date, required: true })
    expiresAt!: Date;

    createdAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
