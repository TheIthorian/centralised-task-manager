import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

export type FuzzyDeadlineType = 'this_week' | 'this_month' | 'someday';
export type RemindEvery = 'daily' | 'weekly';

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

    @Prop({ required: true })
    source!: string;

    @Prop({ required: true })
    sourceId!: string;

    @Prop({ required: true })
    title!: string;

    @Prop({ type: String, default: null })
    description!: string | null;

    @Prop({ required: true, enum: ['open', 'done', 'archived'], default: 'open' })
    status!: 'open' | 'done' | 'archived';

    @Prop({ type: Number, enum: [1, 2, 3, 4], default: null })
    priority!: 1 | 2 | 3 | 4 | null;

    @Prop({ type: [String], default: [] })
    tags!: string[];

    @Prop({ type: Date, default: null })
    sourceDueDate!: Date | null;

    @Prop({ type: FuzzyDeadlineSchema, default: null })
    fuzzyDeadline!: FuzzyDeadline | null;

    @Prop({ required: true })
    syncedAt!: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, source: 1, sourceId: 1 }, { unique: true });
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ 'fuzzyDeadline.remindEvery': 1 });
