import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CODE_CHALLENGE_METHODS, type CodeChallengeMethod } from '../pkce.js';

/** Hydrated Mongoose document type for an AuthCode. */
export type AuthCodeDocument = HydratedDocument<AuthCode>;

@Schema({ timestamps: true })
export class AuthCode {
    @Prop({ type: String, required: true, unique: true })
    code!: string;

    @Prop({ type: String, required: true })
    userId!: string;

    @Prop({ type: String, required: true, maxlength: 2048 })
    redirectUri!: string;

    @Prop({ type: String, required: true, maxlength: 255 })
    codeChallenge!: string;

    @Prop({ type: String, required: true, enum: CODE_CHALLENGE_METHODS, default: 'S256' })
    codeChallengeMethod!: CodeChallengeMethod;

    @Prop({
        type: [String],
        default: ['openid'],
        validate: {
            validator: (scopes: string[]): boolean => scopes.every((scope) => scope.length <= 100),
            message: 'Each scope must be at most 100 characters long',
        },
    })
    scopes!: string[];

    @Prop({ type: String, required: true })
    clientId!: string;

    @Prop({ type: Date, required: true })
    expiresAt!: Date;
}

export const AuthCodeSchema = SchemaFactory.createForClass(AuthCode);
// TTL index: MongoDB auto-deletes expired codes
AuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
