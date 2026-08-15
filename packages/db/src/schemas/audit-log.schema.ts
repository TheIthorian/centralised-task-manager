import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditAction, AuditTargetType } from '../audit.js';

/** Mongoose document type for AuditLog. */
export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * One operator action, written once and never updated.
 *
 * Every field is denormalised on purpose: the log has to stay readable after the thing it
 * describes is gone, and a purged user has no document left to join against.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
    @Prop({ type: String, required: true, enum: AuditAction, index: true })
    action!: AuditAction;

    /** Who acted, as the verified email from their Cloudflare Access identity. */
    @Prop({ type: String, required: true, maxlength: 320 })
    actor!: string;

    @Prop({ type: String, required: true, enum: AuditTargetType })
    targetType!: AuditTargetType;

    /** Identifier of the thing acted on, as a string so a purged id still reads back. */
    @Prop({ type: String, default: null, maxlength: 200 })
    targetId!: string | null;

    /** Human-readable label for the target, captured at write time. */
    @Prop({ type: String, default: null, maxlength: 320 })
    targetLabel!: string | null;

    @Prop({ type: String, default: null, maxlength: 45 })
    ip!: string | null;

    /** Action-specific detail. Free-form because each action records something different. */
    @Prop({ type: Object, default: {} })
    metadata!: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// The log is read newest-first, and filtered by target when answering "what happened to this user".
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
