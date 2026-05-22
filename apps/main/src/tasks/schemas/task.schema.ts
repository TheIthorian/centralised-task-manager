import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

export type FuzzyDeadlineType = 'this_week' | 'this_month' | 'someday';
export type RemindEvery = 'daily' | 'weekly';

@Schema({ _id: false })
class Location {
    @Prop({ type: String, required: true, maxlength: 200 })
    name!: string;

    @Prop({ type: String, required: true, maxlength: 500 })
    googleMapsUrl!: string;
}

const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false })
class FuzzyDeadline {
    @Prop({ type: String, required: true, enum: ['this_week', 'this_month', 'someday'] })
    type!: FuzzyDeadlineType;

    @Prop({ type: String, enum: ['daily', 'weekly'], default: null })
    remindEvery!: RemindEvery | null;
}

const FuzzyDeadlineSchema = SchemaFactory.createForClass(FuzzyDeadline);

@Schema({ timestamps: true })
export class Task {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50 })
    source!: string;

    @Prop({ type: String, required: true, maxlength: 255 })
    sourceId!: string;

    @Prop({ type: String, required: true, maxlength: 200 })
    title!: string;

    @Prop({ type: String, default: null, maxlength: 2000 })
    description!: string | null;

    @Prop({ type: String, required: true, enum: ['open', 'done', 'archived'], default: 'open' })
    status!: 'open' | 'done' | 'archived';

    @Prop({ type: Number, enum: [1, 2, 3, 4], default: null })
    priority!: 1 | 2 | 3 | 4 | null;

    @Prop({
        type: [String],
        default: [],
        validate: {
            validator: (tags: string[]): boolean => tags.every((tag) => tag.length <= 50),
            message: 'Each tag must be at most 50 characters long',
        },
    })
    tags!: string[];

    @Prop({ type: Date, default: null })
    sourceDueDate!: Date | null;

    @Prop({ type: FuzzyDeadlineSchema, default: null })
    fuzzyDeadline!: FuzzyDeadline | null;

    @Prop({ type: [LocationSchema], default: [] })
    locations!: { name: string; googleMapsUrl: string }[];

    @Prop({ type: Date, required: true })
    syncedAt!: Date;

    createdAt?: Date;
    updatedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, source: 1, sourceId: 1 }, { unique: true });
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ 'fuzzyDeadline.remindEvery': 1 });
