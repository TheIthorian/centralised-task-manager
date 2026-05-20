import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthCodeDocument = HydratedDocument<AuthCode>;

@Schema({ timestamps: true })
export class AuthCode {
    @Prop({ type: String, required: true, unique: true })
    code!: string;

    @Prop({ type: String, required: true })
    userId!: string;

    @Prop({ type: String, required: true })
    redirectUri!: string;

    @Prop({ type: String, required: true })
    codeChallenge!: string;

    @Prop({ type: String, required: true, default: 'S256' })
    codeChallengeMethod!: string;

    @Prop({ type: [String], default: ['openid'] })
    scopes!: string[];

    @Prop({ type: Date, required: true })
    expiresAt!: Date;
}

export const AuthCodeSchema = SchemaFactory.createForClass(AuthCode);
// TTL index: MongoDB auto-deletes expired codes
AuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
