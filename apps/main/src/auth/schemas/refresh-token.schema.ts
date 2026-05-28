import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mongoose document type for RefreshToken. */
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
    @Prop({ type: String, required: true, index: true })
    tokenHash!: string;

    @Prop({ type: String, required: true, index: true })
    userId!: string;

    @Prop({ type: String })
    clientId?: string;

    @Prop({ type: [String], default: [] })
    scopes!: string[];

    @Prop({ type: Date, required: true })
    expiresAt!: Date;

    createdAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
