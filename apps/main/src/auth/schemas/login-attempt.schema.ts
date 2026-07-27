import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for LoginAttempt. */
export type LoginAttemptDocument = HydratedDocument<LoginAttempt>;

/** Consecutive failed logins for one account, used to lock it out temporarily. */
@Schema({ timestamps: true })
export class LoginAttempt {
    @Prop({ type: String, required: true, unique: true })
    email!: string;

    @Prop({ type: Number, required: true, default: 0 })
    failedCount!: number;

    @Prop({ type: Date, default: null })
    lockedUntil!: Date | null;

    @Prop({ type: Date, required: true })
    expiresAt!: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);

LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
