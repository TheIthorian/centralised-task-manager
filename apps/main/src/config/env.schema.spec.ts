import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema.js';

describe('envSchema', () => {
    const validEnv = {
        MONGODB_URI: 'mongodb://localhost:27017/ctm',
        JWT_SECRET: 'a'.repeat(32),
        ENCRYPTION_KEY: 'a'.repeat(64),
        RSA_PRIVATE_KEY: 'dGVzdA==',
        RSA_PUBLIC_KEY: 'dGVzdA==',
        PORT: 3000,
        NODE_ENV: 'test',
        REDIRECT_BASE_URL: 'http://localhost:3000',
        WEB_URL: 'http://localhost:5173',
        MCP_PUBLIC_URL: 'http://localhost:3002',
        JWT_ACCESS_EXPIRES: 900,
        REFRESH_TOKEN_EXPIRES_DAYS: 30,
        LOG_LEVEL: 'info',
        EXPORT_DIR: '/tmp/exports',
        COOKIE_PATH: '/api/auth/refresh',
        COOKIE_SECURE: false,
        RATE_LIMIT_BURST_PER_MINUTE: 60,
        RATE_LIMIT_SUSTAINED_PER_HOUR: 1000,
        RATE_LIMIT_STRICT_BURST_PER_MINUTE: 10,
        RATE_LIMIT_STRICT_SUSTAINED_PER_HOUR: 100,
        RATE_LIMIT_REFRESH_BURST_PER_MINUTE: 30,
        RATE_LIMIT_REFRESH_SUSTAINED_PER_HOUR: 600,
        RATE_LIMIT_CLIENT_BURST_PER_MINUTE: 40,
        RATE_LIMIT_CLIENT_SUSTAINED_PER_HOUR: 700,
        LOGIN_MAX_FAILED_ATTEMPTS: 5,
        LOGIN_LOCKOUT_MINUTES: 15,
        MAX_CONNECTIONS_PER_CONNECTOR: 5,
        MAX_TASKS_PER_USER: 10000,
    };

    it('accepts valid env', () => {
        const { error } = envSchema.validate(validEnv);
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

    it('rejects an env without COOKIE_PATH', () => {
        const { COOKIE_PATH, ...withoutCookiePath } = validEnv;
        const { error } = envSchema.validate(withoutCookiePath);

        expect(error?.message).toContain('COOKIE_PATH');
    });

    it('rejects an env without COOKIE_SECURE', () => {
        const { COOKIE_SECURE, ...withoutCookieSecure } = validEnv;
        const { error } = envSchema.validate(withoutCookieSecure);

        expect(error?.message).toContain('COOKIE_SECURE');
    });

    it('rejects an env without MCP_PUBLIC_URL', () => {
        const { MCP_PUBLIC_URL, ...withoutMcpUrl } = validEnv;
        const { error } = envSchema.validate(withoutMcpUrl);

        expect(error?.message).toContain('MCP_PUBLIC_URL');
    });

    it('falls back to the default abuse limits when they are unset', () => {
        const {
            RATE_LIMIT_BURST_PER_MINUTE,
            RATE_LIMIT_SUSTAINED_PER_HOUR,
            LOGIN_MAX_FAILED_ATTEMPTS,
            MAX_TASKS_PER_USER,
            ...withoutLimits
        } = validEnv;
        const { error, value } = envSchema.validate(withoutLimits);

        expect(error).toBeUndefined();
        expect(value.RATE_LIMIT_BURST_PER_MINUTE).toBe(60);
        expect(value.RATE_LIMIT_SUSTAINED_PER_HOUR).toBe(1000);
        expect(value.LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
        expect(value.MAX_TASKS_PER_USER).toBe(10000);
    });

    it('rejects a zero MAX_TASKS_PER_USER', () => {
        const { error } = envSchema.validate({ ...validEnv, MAX_TASKS_PER_USER: 0 });

        expect(error?.message).toContain('MAX_TASKS_PER_USER');
    });

    it('coerces COOKIE_SECURE to a boolean', () => {
        const { value } = envSchema.validate({ ...validEnv, COOKIE_SECURE: 'true' });

        expect(value.COOKIE_SECURE).toBe(true);
    });
});
