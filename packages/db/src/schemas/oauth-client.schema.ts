import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for OAuthClient. */
export type OAuthClientDocument = HydratedDocument<OAuthClient>;

/** A client's logo after it has been fetched from `logoUri`, validated and re-encoded. */
@Schema({ _id: false })
export class OAuthClientLogo {
    @Prop({ type: Buffer, required: true })
    data!: Buffer;

    @Prop({ type: String, required: true })
    contentType!: string;

    @Prop({ type: Date, required: true })
    fetchedAt!: Date;
}

export const OAuthClientLogoSchema = SchemaFactory.createForClass(OAuthClientLogo);

/** How a client came to be known to this authorization server. */
export enum OAuthClientRegistration {
    /** Shipped by this project and upserted at boot. */
    FirstParty = 'first_party',
    /** Registered itself through RFC 7591 dynamic client registration. */
    Dynamic = 'dynamic',
    /** Identified by an https URL resolved to a Client ID Metadata Document. */
    ClientIdMetadataDocument = 'cimd',
}

@Schema({ timestamps: true })
export class OAuthClient {
    @Prop({ type: String, required: true, unique: true })
    clientId!: string;

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

    @Prop({ type: String, enum: OAuthClientRegistration, default: OAuthClientRegistration.Dynamic })
    registrationType!: OAuthClientRegistration;

    /**
     * When the cached copy of a Client ID Metadata Document stops being usable and has to be
     * fetched again. Absent for every other kind of client.
     */
    @Prop({ type: Date })
    metadataExpiresAt?: Date;

    // RFC 7591 §2 display metadata, self-declared by the client and never verified by this server.

    /** The URI the client declared. Never returned to a browser; `logo` is served instead. */
    @Prop({ type: String })
    logoUri?: string;

    /** Absent when no logo was declared, or when fetching or validating it failed. */
    @Prop({ type: OAuthClientLogoSchema })
    logo?: OAuthClientLogo;

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
