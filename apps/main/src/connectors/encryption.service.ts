import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class EncryptionService {
    private readonly key: Buffer;

    constructor(config: ConfigService) {
        this.key = Buffer.from(config.getOrThrow<string>('ENCRYPTION_KEY'), 'hex');
    }

    /** Encrypt a plaintext string. Returns base64-encoded iv+tag+ciphertext. */
    encrypt(plaintext: string): string {
        const iv = randomBytes(IV_LEN);
        const cipher = createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }

    /** Decrypt a base64 ciphertext produced by encrypt(). */
    decrypt(ciphertext: string): string {
        const buf = Buffer.from(ciphertext, 'base64');
        const iv = buf.subarray(0, IV_LEN);
        const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
        const encrypted = buf.subarray(IV_LEN + TAG_LEN);
        const decipher = createDecipheriv(ALGORITHM, this.key, iv);

        decipher.setAuthTag(tag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    }
}
