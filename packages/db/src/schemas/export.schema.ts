import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StoredFile, StoredFileSchema } from './stored-file.schema.js';

export type ExportDocument = HydratedDocument<Export>;

@Schema({ timestamps: true })
export class Export {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    /** UUID used as the storage prefix for this export's files. */
    @Prop({ type: String, required: true, unique: true })
    exportId!: string;

    @Prop({ type: [StoredFileSchema], default: [] })
    files!: StoredFile[];

    createdAt?: Date;
}

export const ExportSchema = SchemaFactory.createForClass(Export);
