import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ type: String, default: '' })
    name!: string;

    @Prop({ type: String, required: true })
    passwordHash!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
