import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { NotificationData, NotificationType } from '../notification-types.js';

/** Hydrated Mongoose document type for a Notification. */
export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({
        type: String,
        required: true,
        enum: ['connector_reconnect', 'daily_summary', 'reminder', 'upcoming_deadline'],
    })
    type!: NotificationType;

    @Prop({ type: String, required: true, maxlength: 200 })
    title!: string;

    @Prop({ type: String, required: true, maxlength: 2000 })
    body!: string;

    @Prop({ type: Object, default: null })
    data!: NotificationData | null;

    @Prop({ type: Boolean, default: false })
    read!: boolean;

    createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
