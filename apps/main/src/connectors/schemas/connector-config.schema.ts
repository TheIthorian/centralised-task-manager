import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConnectorConfigDocument = HydratedDocument<ConnectorConfig>;

@Schema({ timestamps: true })
export class ConnectorConfig {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true })
    source!: string;

    @Prop({ type: String, required: true })
    accessToken!: string;

    @Prop({ type: String, default: '' })
    refreshToken!: string;

    @Prop({ type: Date, required: true })
    tokenExpiresAt!: Date;

    @Prop({ type: Object, default: {} })
    settings!: Record<string, unknown>;

    @Prop({ type: Date, default: null })
    lastSyncedAt!: Date | null;

    @Prop({ type: String, default: null })
    lastError!: string | null;

    @Prop({ type: Boolean, default: true })
    enabled!: boolean;
}

export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
ConnectorConfigSchema.index({ userId: 1, source: 1 }, { unique: true });
