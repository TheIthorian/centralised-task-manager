import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from './files.service.js';
import { LocalFileStorage } from './storage/local-file-storage.js';

function makeService(dir: string): FilesService {
    const storage = new LocalFileStorage(dir);
    // FilesService expects @Inject(FILE_STORAGE) — instantiate directly for unit tests
    return new FilesService(storage);
}

describe('FilesService', () => {
    let tmpDir: string;
    let service: FilesService;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ctm-files-'));
        service = makeService(tmpDir);
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('save returns StoredFile with correct metadata', async () => {
        const data = Buffer.from('{"test":true}');
        const result = await service.save({
            prefix: 'abc',
            filename: 'part-1.json',
            data,
            contentType: 'application/json',
        });

        expect(result.filename).toBe('part-1.json');
        expect(result.sizeBytes).toBe(data.length);
        expect(result.contentType).toBe('application/json');
        expect(result.sha256).toHaveLength(64);
        expect(result.storagePath).toBe('abc/part-1.json');
    });

    it('sha256 is stable across calls for same data', async () => {
        const data = Buffer.from('stable');
        const a = await service.save({ prefix: 'p', filename: 'a.json', data, contentType: 'application/json' });
        const b = await service.save({ prefix: 'q', filename: 'b.json', data, contentType: 'application/json' });
        expect(a.sha256).toBe(b.sha256);
    });

    it('readByPath returns the saved content', async () => {
        const data = Buffer.from('hello');
        await service.save({ prefix: 'r', filename: 'x.json', data, contentType: 'application/json' });
        const read = await service.readByPath('r/x.json');
        expect(read.toString()).toBe('hello');
    });

    it('deletePrefix removes all files', async () => {
        await service.save({ prefix: 's', filename: 'f.json', data: Buffer.from('x'), contentType: 'application/json' });
        await service.deletePrefix('s');
        // Reading after delete should throw
        await expect(service.readByPath('s/f.json')).rejects.toThrow();
    });
});
