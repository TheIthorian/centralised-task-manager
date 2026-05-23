import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Mongoose document type for ConnectorConfig. */
export type ConnectorConfigDocument = HydratedDocument<ConnectorConfig>;

type OAuthConnectorConfig = {
    source: 'todoist' | 'google_tasks' | 'notion';
    settings: Record<string, unknown>;
    internalSettings: Record<string, unknown>;
};

type DiscordConnectorConfig = {
    source: 'discord';
    settings: { discordUserId: string };
    internalSettings: { botToken: string; dmChannelId: string | null };
};

/** `ConnectorConfig` narrowed by `source` discriminant. */
export type TypedConnectorConfig = ConnectorConfig & (OAuthConnectorConfig | DiscordConnectorConfig);

@Schema({ timestamps: true })
export class ConnectorConfig {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50 })
    source!: string;

    @Prop({ type: String, required: true })
    accessToken!: string;

    @Prop({ type: String, default: '' })
    refreshToken!: string;

    @Prop({ type: Date, required: true })
    tokenExpiresAt!: Date;

    @Prop({ type: Object, default: {} })
    settings!: Record<string, unknown>;

    /** Server-only config — never included in API responses. */
    @Prop({ type: Object, default: {} })
    internalSettings!: Record<string, unknown>;

    @Prop({ type: Date, default: null })
    lastSyncedAt!: Date | null;

    @Prop({ type: String, default: null, maxlength: 2000 })
    lastError!: string | null;

    @Prop({ type: Boolean, default: true })
    enabled!: boolean;
}

export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
ConnectorConfigSchema.index({ userId: 1, source: 1 }, { unique: true });
