import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ConnectorName } from '@ctm/connectors';
import { ConnectorSettings } from './types';

@Schema({ timestamps: true })
export class ConnectorConfig<TConfig extends ConnectorSettings = ConnectorSettings> {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50, enum: ConnectorName })
    source!: TConfig['source'];

    @Prop({ type: String, default: null, maxlength: 255 })
    externalAccountId!: string | null;

    @Prop({ type: String, default: null, maxlength: 320 })
    email!: string | null;

    @Prop({ type: String, default: null, maxlength: 200 })
    label!: string | null;

    @Prop({ type: String, required: true })
    accessToken!: string;

    @Prop({ type: String, default: '' })
    refreshToken!: string;

    @Prop({ type: Date, required: true })
    tokenExpiresAt!: Date;

    @Prop({ type: Object, default: {} })
    settings!: TConfig['settings'];

    @Prop({ type: Date, default: null })
    lastSyncedAt!: Date | null;

    @Prop({ type: String, default: null, maxlength: 2000 })
    lastError!: string | null;

    @Prop({ type: Boolean, default: true })
    enabled!: boolean;
}

/** Mongoose document type for ConnectorConfig. */
export type ConnectorConfigDocument = HydratedDocument<ConnectorConfig>;

export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
// One row per connected external account. Partial filter lets legacy rows
// (externalAccountId null, pre-backfill) coexist without violating uniqueness.
ConnectorConfigSchema.index(
    { userId: 1, source: 1, externalAccountId: 1 },
    { unique: true, partialFilterExpression: { externalAccountId: { $type: 'string' } } },
);
