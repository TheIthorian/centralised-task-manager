import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalFileStorage } from './local-file-storage.js';

describe('LocalFileStorage', () => {
    let tmpDir: string;
    let storage: LocalFileStorage;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ctm-storage-test-'));
        storage = new LocalFileStorage(tmpDir);
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('save + read round-trip', async () => {
        const data = Buffer.from('{"test":true}');
        await storage.save('my-prefix', 'file.json', data);
        const result = await storage.read('my-prefix', 'file.json');
        expect(result.toString()).toBe('{"test":true}');
    });

    it('list returns filenames under prefix', async () => {
        await storage.save('p', 'a.json', Buffer.from('a'));
        await storage.save('p', 'b.json', Buffer.from('b'));
        const files = await storage.list('p');
        expect(files.sort()).toEqual(['a.json', 'b.json']);
    });

    it('list returns empty array for unknown prefix', async () => {
        expect(await storage.list('nonexistent')).toEqual([]);
    });

    it('delete removes all files under prefix', async () => {
        await storage.save('p', 'a.json', Buffer.from('a'));
        await storage.delete('p');
        expect(await storage.list('p')).toEqual([]);
    });

    it('delete is a no-op for nonexistent prefix', async () => {
        await expect(storage.delete('ghost')).resolves.toBeUndefined();
    });
});
