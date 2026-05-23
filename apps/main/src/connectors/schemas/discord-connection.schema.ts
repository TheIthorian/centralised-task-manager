import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DiscordConnectionDocument = HydratedDocument<DiscordConnection>;

@Schema({ timestamps: true })
export class DiscordConnection {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    userId!: Types.ObjectId;

    /** Discord snowflake ID for the user. */
    @Prop({ type: String, required: true })
    discordUserId!: string;

    /** Cached DM channel ID — avoids re-opening the DM channel on each message. */
    @Prop({ type: String, default: null })
    dmChannelId!: string | null;
}

export const DiscordConnectionSchema = SchemaFactory.createForClass(DiscordConnection);
