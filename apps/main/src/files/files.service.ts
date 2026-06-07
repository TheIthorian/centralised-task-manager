import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { FILE_STORAGE, type FileStorage } from './storage/file-storage.interface.js';
import type { StoredFile } from './schemas/stored-file.schema.js';

@Injectable()
export class FilesService {
    constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

    /** Save a file to storage and return its persisted metadata. */
    async save({
        prefix,
        filename,
        data,
        contentType,
    }: {
        prefix: string;
        filename: string;
        data: Buffer;
        contentType: string;
    }): Promise<StoredFile> {
        await this.storage.save(prefix, filename, data);

        const sha256 = createHash('sha256').update(data).digest('hex');

        return { storagePath: `${prefix}/${filename}`, filename, sizeBytes: data.length, contentType, sha256 };
    }

    /** Read a file from storage by its storagePath (prefix/filename). */
    async readByPath(storagePath: string): Promise<Buffer> {
        const slash = storagePath.indexOf('/');
        const prefix = storagePath.slice(0, slash);
        const filename = storagePath.slice(slash + 1);

        return this.storage.read(prefix, filename);
    }

    /** Delete all files under a prefix. */
    async deletePrefix(prefix: string): Promise<void> {
        return this.storage.delete(prefix);
    }
}
