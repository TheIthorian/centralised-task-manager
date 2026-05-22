import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
class ChannelPrefs {
    @Prop({ type: Boolean, default: true })
    inApp!: boolean;

    @Prop({ type: Boolean, default: false })
    discord!: boolean;

    @Prop({ type: Boolean, default: false })
    email!: boolean;
}

const ChannelPrefsSchema = SchemaFactory.createForClass(ChannelPrefs);

export type NotificationPreferences = {
    connectorReconnect: ChannelPrefs;
    dailySummary: ChannelPrefs;
    reminder: ChannelPrefs;
    upcomingDeadline: ChannelPrefs;
};

@Schema({ _id: false })
class NotificationPreferencesClass {
    @Prop({ type: ChannelPrefsSchema, default: () => ({}) })
    connectorReconnect!: ChannelPrefs;

    @Prop({ type: ChannelPrefsSchema, default: () => ({}) })
    dailySummary!: ChannelPrefs;

    @Prop({ type: ChannelPrefsSchema, default: () => ({}) })
    reminder!: ChannelPrefs;

    @Prop({ type: ChannelPrefsSchema, default: () => ({}) })
    upcomingDeadline!: ChannelPrefs;
}

const NotificationPreferencesSchema = SchemaFactory.createForClass(NotificationPreferencesClass);

@Schema({ timestamps: true })
export class User {
    @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 320 })
    email!: string;

    @Prop({ type: String, default: '', maxlength: 100 })
    name!: string;

    @Prop({ type: String, required: true })
    passwordHash!: string;

    @Prop({ type: NotificationPreferencesSchema, default: () => ({}) })
    notificationPreferences!: NotificationPreferencesClass;
}

export const UserSchema = SchemaFactory.createForClass(User);
