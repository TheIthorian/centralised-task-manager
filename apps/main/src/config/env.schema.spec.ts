import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema.js';

describe('envSchema', () => {
    it('accepts valid env', () => {
        const { error } = envSchema.validate({
            MONGODB_URI: 'mongodb://localhost:27017/ctm',
            JWT_SECRET: 'a'.repeat(32),
            ENCRYPTION_KEY: 'a'.repeat(64),
            RSA_PRIVATE_KEY: 'dGVzdA==',
            RSA_PUBLIC_KEY: 'dGVzdA==',
        });
        expect(error).toBeUndefined();
    });

    it('rejects missing MONGODB_URI', () => {
        const { error } = envSchema.validate({
            JWT_SECRET: 'a'.repeat(32),
            ENCRYPTION_KEY: 'a'.repeat(64),
        });
        expect(error).toBeDefined();
    });

    it('rejects short JWT_SECRET', () => {
        const { error } = envSchema.validate({
            MONGODB_URI: 'mongodb://localhost',
            JWT_SECRET: 'short',
            ENCRYPTION_KEY: 'a'.repeat(64),
        });
        expect(error).toBeDefined();
    });

    it('rejects wrong-length ENCRYPTION_KEY', () => {
        const { error } = envSchema.validate({
            MONGODB_URI: 'mongodb://localhost',
            JWT_SECRET: 'a'.repeat(32),
            ENCRYPTION_KEY: 'abc',
        });
        expect(error).toBeDefined();
    });
});
