import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for OAuthClient. */
export type OAuthClientDocument = HydratedDocument<OAuthClient>;

@Schema({ timestamps: true })
export class OAuthClient {
    @Prop({ type: String, required: true, unique: true })
    clientId!: string;

    @Prop({ type: String, required: true })
    clientSecretHash!: string;

    @Prop({ type: String, default: '' })
    clientName!: string;

    @Prop({ type: [String], default: [] })
    redirectUris!: string[];

    @Prop({ type: [String], default: ['authorization_code'] })
    grantTypes!: string[];

    @Prop({ type: [String], default: ['code'] })
    responseTypes!: string[];

    @Prop({ type: [String], default: ['openid', 'email', 'profile'] })
    scopes!: string[];

    @Prop({ type: Boolean, default: true })
    isDynamic!: boolean;

    // RFC 7591 §2 display metadata, self-declared by the client and never verified by this server.

    /** Stored but never returned to a browser: see the logo handling in the #28 design spec. */
    @Prop({ type: String })
    logoUri?: string;

    @Prop({ type: String })
    clientUri?: string;

    @Prop({ type: String })
    tosUri?: string;

    @Prop({ type: String })
    policyUri?: string;

    @Prop({ type: [String] })
    contacts?: string[];

    @Prop({ type: String })
    softwareId?: string;

    @Prop({ type: Date, default: () => new Date() })
    issuedAt!: Date;

    /** Set the first time the client completes an authorization. Absent until then. */
    @Prop({ type: Date })
    lastUsedAt?: Date;

    /** Reaping deadline for a client that has never been used. Unset on first use. */
    @Prop({ type: Date })
    unusedExpiresAt?: Date;
}

export const OAuthClientSchema = SchemaFactory.createForClass(OAuthClient);

// Reaps anonymously registered clients that were never used. MongoDB's TTL monitor skips
// documents where the indexed field is absent, so clients that have been used are never
// collected: `markUsed` unsets the field.
OAuthClientSchema.index({ unusedExpiresAt: 1 }, { expireAfterSeconds: 0 });
