import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Embedded sub-document representing a file persisted to FileStorage. No collection — embed in owning schemas. */
@Schema({ _id: false })
export class StoredFile {
    /** Opaque key passed to FileStorage.read() — e.g. "exports/{exportId}/export-part-1.json". */
    @Prop({ type: String, required: true })
    storagePath!: string;

    @Prop({ type: String, required: true })
    filename!: string;

    @Prop({ type: Number, required: true })
    sizeBytes!: number;

    /** MIME type, e.g. "application/json". */
    @Prop({ type: String, required: true })
    contentType!: string;

    /** Hex-encoded SHA-256 of file content for integrity verification. */
    @Prop({ type: String, required: true })
    sha256!: string;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);
