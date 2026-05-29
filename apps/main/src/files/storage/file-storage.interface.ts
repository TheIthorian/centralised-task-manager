/** Injection token for the FileStorage provider. */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Generic interface for binary file storage. Implementations: LocalFileStorage, S3FileStorage. */
export type FileStorage = {
    /** Save data under the given prefix/filename. Creates directories as needed. */
    save(prefix: string, filename: string, data: Buffer): Promise<void>;
    /** Read a previously saved file. */
    read(prefix: string, filename: string): Promise<Buffer>;
    /** List all filenames under a prefix. Returns [] if prefix does not exist. */
    list(prefix: string): Promise<string[]>;
    /** Delete all files under a prefix. No-op if prefix does not exist. */
    delete(prefix: string): Promise<void>;
};
