import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApiTokenDocument = HydratedDocument<ApiToken>;

@Schema({ timestamps: true })
export class ApiToken {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true })
    tokenHash!: string;

    @Prop({ type: String, required: true, maxlength: 100 })
    label!: string;

    @Prop({ type: Date, default: null })
    lastUsedAt!: Date | null;
}

export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);
