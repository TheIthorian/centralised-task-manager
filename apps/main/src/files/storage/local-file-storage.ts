import { mkdirSync } from 'fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { FileStorage } from './file-storage.interface.js';

export class LocalFileStorage implements FileStorage {
    constructor(private readonly baseDir: string) {
        mkdirSync(baseDir, { recursive: true });
    }

    async save(prefix: string, filename: string, data: Buffer): Promise<void> {
        const dir = join(this.baseDir, prefix);

        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, filename), data);
    }

    async read(prefix: string, filename: string): Promise<Buffer> {
        return readFile(join(this.baseDir, prefix, filename));
    }

    async list(prefix: string): Promise<string[]> {
        const dir = join(this.baseDir, prefix);

        try {
            return await readdir(dir);
        } catch {
            return [];
        }
    }

    async delete(prefix: string): Promise<void> {
        const dir = join(this.baseDir, prefix);

        await rm(dir, { recursive: true, force: true });
    }
}
