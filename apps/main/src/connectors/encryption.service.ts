import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class EncryptionService {
    private readonly key: Uint8Array;

    constructor(config: ConfigService) {
        this.key = new Uint8Array(Buffer.from(config.getOrThrow<string>('ENCRYPTION_KEY'), 'hex'));
    }

    /** Encrypt a plaintext string. Returns base64-encoded iv+tag+ciphertext. */
    encrypt(plaintext: string): string {
        const iv = new Uint8Array(randomBytes(IV_LEN));
        const cipher = createCipheriv(ALGORITHM, this.key, iv);
        const update = new Uint8Array(cipher.update(plaintext, 'utf8'));
        const final = new Uint8Array(cipher.final());
        const encrypted = new Uint8Array(Buffer.concat([update, final]));
        const tag = new Uint8Array(cipher.getAuthTag());

        return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }

    /** Decrypt a base64 ciphertext produced by encrypt(). */
    decrypt(ciphertext: string): string {
        const buf = Buffer.from(ciphertext, 'base64');
        const iv = new Uint8Array(buf.subarray(0, IV_LEN));
        const tag = new Uint8Array(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
        const encrypted = new Uint8Array(buf.subarray(IV_LEN + TAG_LEN));
        const decipher = createDecipheriv(ALGORITHM, this.key, iv);

        decipher.setAuthTag(tag);

        const decUpdate = new Uint8Array(decipher.update(encrypted));
        const decFinal = new Uint8Array(decipher.final());

        return Buffer.concat([decUpdate, decFinal]).toString('utf8');
    }
}
