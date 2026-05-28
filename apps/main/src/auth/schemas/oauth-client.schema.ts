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

    @Prop({ type: Date, default: () => new Date() })
    issuedAt!: Date;
}

export const OAuthClientSchema = SchemaFactory.createForClass(OAuthClient);
