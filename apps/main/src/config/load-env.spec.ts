import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { ConfigurationError } from '@ctm/errors';
import { loadEnv, resetEnvCache, toLoggerConfig } from './load-env.js';

const REQUIRED = {
    MONGODB_URI: 'mongodb://localhost:27017/ctm',
    JWT_SECRET: 'a'.repeat(32),
    ENCRYPTION_KEY: 'a'.repeat(64),
    RSA_PRIVATE_KEY: 'dGVzdA==',
    RSA_PUBLIC_KEY: 'dGVzdA==',
    PORT: '3000',
    NODE_ENV: 'test',
    REDIRECT_BASE_URL: 'http://localhost:3000',
    WEB_URL: 'http://localhost:5173',
    MCP_PUBLIC_URL: 'http://localhost:3002',
    CIMD_TRUSTED_DOMAINS: 'claude.ai',
    JWT_ACCESS_EXPIRES: '900',
    REFRESH_TOKEN_EXPIRES_DAYS: '30',
    LOG_LEVEL: 'info',
    EXPORT_DIR: '/tmp/exports',
    COOKIE_PATH: '/api/auth/refresh',
    COOKIE_SECURE: 'false',
};

const original = { ...process.env };

beforeEach(() => {
    resetEnvCache();
});

afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
});

describe('loadEnv', () => {
    it('coerces and defaults the logging variables', () => {
        setEnv(REQUIRED);

        expect(loadEnv()).toMatchObject({ LOG_LEVEL: 'info', LOG_PRETTY: false, LOG_REDACT: true });
    });

    it('validates once and reuses the result', () => {
        setEnv(REQUIRED);

        const first = loadEnv();
        process.env['LOG_LEVEL'] = 'trace';

        // The second call must not re-read: bootstrap and ConfigModule have to agree on one answer.
        expect(loadEnv()).toBe(first);
        expect(loadEnv()['LOG_LEVEL']).toBe('info');
    });

    it('throws a typed error when the environment is invalid', () => {
        setEnv({ ...REQUIRED, LOG_LEVEL: 'verbose' });

        expect(() => loadEnv()).toThrow(ConfigurationError);
        expect(() => loadEnv()).toThrow(/LOG_LEVEL/);
    });

    it('refuses to boot production with redaction off', () => {
        setEnv({ ...REQUIRED, NODE_ENV: 'production', LOG_REDACT: 'false' });

        expect(() => loadEnv()).toThrow(/LOG_REDACT must be true when NODE_ENV=production/);
    });

    it('refuses to boot production with pretty printing on', () => {
        setEnv({ ...REQUIRED, NODE_ENV: 'production', LOG_PRETTY: 'true' });

        expect(() => loadEnv()).toThrow(/LOG_PRETTY must be false when NODE_ENV=production/);
    });

    it('keeps the variables the schema does not name', () => {
        setEnv({ ...REQUIRED, SOME_OTHER_VAR: 'kept' });

        expect(loadEnv()).toMatchObject({ SOME_OTHER_VAR: 'kept' });
    });
});

describe('toLoggerConfig', () => {
    it('narrows validated env to the logger config', () => {
        setEnv(REQUIRED);

        expect(toLoggerConfig(loadEnv())).toEqual({ level: 'info', pretty: false, redact: true });
    });

    it('refuses raw process.env, which has not been coerced', () => {
        expect(() => toLoggerConfig({ LOG_LEVEL: 'info', LOG_PRETTY: 'false', LOG_REDACT: 'true' })).toThrow(
            ConfigurationError,
        );
    });
});

function setEnv(env: Record<string, string>): void {
    process.env = { ...env };
}
