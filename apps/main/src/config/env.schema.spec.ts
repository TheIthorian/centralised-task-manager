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
            PORT: 3000,
            NODE_ENV: 'test',
            REDIRECT_BASE_URL: 'http://localhost:3000',
            WEB_URL: 'http://localhost:5173',
            JWT_ACCESS_EXPIRES: 900,
            REFRESH_TOKEN_EXPIRES_DAYS: 30,
            LOG_LEVEL: 'info',
            EXPORT_DIR: '/tmp/exports',
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
