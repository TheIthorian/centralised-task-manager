import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type JobDocument = HydratedDocument<Job>;

@Schema({ discriminatorKey: 'type', timestamps: true })
export class Job {
	@Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
	userId!: Types.ObjectId;

	@Prop({ type: String, required: true })
	type!: string;

	@Prop({ type: String, required: true, enum: ['queued', 'running', 'done', 'failed', 'cancelled'], default: 'queued' })
	status!: JobStatus;

	@Prop({ type: Date, default: null })
	completedAt!: Date | null;

	@Prop({ type: String, default: null })
	error!: string | null;

	createdAt?: Date;
	updatedAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ userId: 1, type: 1, status: 1 });
