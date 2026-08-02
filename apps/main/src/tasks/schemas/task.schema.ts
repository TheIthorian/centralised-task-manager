import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

/** The fuzzy (non-exact) deadline bucket for a task. */
export type FuzzyDeadlineType = 'this_week' | 'this_month' | 'someday';

/** How often a task with a fuzzy deadline should be surfaced in reminders. */
export type RemindEvery = 'daily' | 'weekly';

/** The kind of relation from one task to another. */
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

/** Maps each relation type to the inverse type stored on the target task. */
export const RELATION_INVERSE: Record<RelationType, RelationType> = {
    parent: 'child',
    child: 'parent',
    next: 'previous',
    previous: 'next',
    related: 'related',
};

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

@Schema({ _id: false })
class DueDate {
    @Prop({ type: Date, required: true })
    date!: Date;

    @Prop({ type: String, default: null })
    timezone!: string | null;

    @Prop({ type: String, default: null })
    recurrence!: string | null;

    /** An all-day date has no instant: `date` is the UTC midnight of the calendar day it names. */
    @Prop({ type: Boolean, default: false })
    allDay!: boolean;
}

const DueDateSchema = SchemaFactory.createForClass(DueDate);

@Schema({ _id: false })
class Duration {
    @Prop({ type: Number, required: true })
    amount!: number;

    @Prop({ type: String, required: true, enum: ['minute', 'day'] })
    unit!: 'minute' | 'day';
}

const DurationSchema = SchemaFactory.createForClass(Duration);

@Schema({ _id: false })
class TaskRelation {
    @Prop({ type: String, required: true, enum: ['parent', 'child', 'next', 'previous', 'related'] })
    type!: RelationType;

    @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
    targetTaskId!: Types.ObjectId;
}

const TaskRelationSchema = SchemaFactory.createForClass(TaskRelation);

@Schema({ _id: false })
class Reminder {
    @Prop({ type: Date, required: true })
    remindAt!: Date;

    @Prop({ type: Date, default: null })
    firedAt!: Date | null;
}

const ReminderSchema = SchemaFactory.createForClass(Reminder);

@Schema({ timestamps: true })
export class Task {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50 })
    source!: string;

    @Prop({ type: String, required: true, maxlength: 255 })
    sourceId!: string;

    @Prop({ type: String, default: null, maxlength: 255 })
    externalAccountId!: string | null;

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

    @Prop({ type: DueDateSchema, default: null })
    due!: { date: Date; timezone: string | null; recurrence: string | null; allDay: boolean } | null;

    @Prop({ type: Date, default: null })
    deadlineDate!: Date | null;

    @Prop({ type: DurationSchema, default: null })
    duration!: { amount: number; unit: 'minute' | 'day' } | null;

    @Prop({ type: [TaskRelationSchema], default: [] })
    relations!: { type: RelationType; targetTaskId: Types.ObjectId }[];

    @Prop({ type: FuzzyDeadlineSchema, default: null })
    fuzzyDeadline!: FuzzyDeadline | null;

    @Prop({ type: [ReminderSchema], default: [] })
    reminders!: { remindAt: Date; firedAt: Date | null }[];

    @Prop({ type: Date, default: null })
    dueDateNotifiedAt!: Date | null;

    @Prop({ type: [LocationSchema], default: [] })
    locations!: { name: string; googleMapsUrl: string }[];

    @Prop({ type: Date, required: true })
    syncedAt!: Date;

    createdAt?: Date;
    updatedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, source: 1, externalAccountId: 1, sourceId: 1 }, { unique: true });
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ 'fuzzyDeadline.remindEvery': 1 });
TaskSchema.index({ userId: 1, 'relations.targetTaskId': 1 });
TaskSchema.index({ 'reminders.remindAt': 1, 'reminders.firedAt': 1 });
TaskSchema.index({ 'due.date': 1, dueDateNotifiedAt: 1 });
