import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { FileStorage } from './file-storage.interface.js';

export class LocalFileStorage implements FileStorage {
    constructor(private readonly baseDir: string) {
        mkdirSync(baseDir, { recursive: true });
    }

    async save(prefix: string, filename: string, data: Buffer): Promise<void> {
        const dir = join(this.baseDir, prefix);

        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, filename), data);
    }

    async read(prefix: string, filename: string): Promise<Buffer> {
        return readFileSync(join(this.baseDir, prefix, filename));
    }

    async list(prefix: string): Promise<string[]> {
        const dir = join(this.baseDir, prefix);

        if (!existsSync(dir)) return [];

        return readdirSync(dir);
    }

    async delete(prefix: string): Promise<void> {
        const dir = join(this.baseDir, prefix);

        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
}
