import { describe, it, expect } from 'vitest';
import { EncryptionService } from './encryption.service.js';

describe('EncryptionService', () => {
    const makeService = (): EncryptionService =>
        new EncryptionService({
            getOrThrow: () => 'a'.repeat(64),
        } as unknown as import('@nestjs/config').ConfigService);

    it('round-trips plaintext', () => {
        const svc = makeService();
        const cipher = svc.encrypt('secret-token');

        expect(svc.decrypt(cipher)).toBe('secret-token');
    });

    it('each encryption produces different ciphertext', () => {
        const svc = makeService();

        expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
    });
});
