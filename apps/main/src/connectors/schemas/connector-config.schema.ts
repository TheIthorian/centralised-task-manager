import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConnectorConfigDocument = HydratedDocument<ConnectorConfig>;

@Schema({ timestamps: true })
export class ConnectorConfig {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ required: true })
    source!: string;

    @Prop({ required: true })
    accessToken!: string;

    @Prop({ default: '' })
    refreshToken!: string;

    @Prop({ required: true })
    tokenExpiresAt!: Date;

    @Prop({ type: Object, default: {} })
    settings!: Record<string, unknown>;

    @Prop({ default: null })
    lastSyncedAt!: Date | null;

    @Prop({ default: null })
    lastError!: string | null;

    @Prop({ default: true })
    enabled!: boolean;
}

export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
ConnectorConfigSchema.index({ userId: 1, source: 1 }, { unique: true });
