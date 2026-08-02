import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { ConfigurationError } from '@ctm/errors';
import { loadEnv, resetEnvCache, toLoggerConfig } from './load-env.js';

const REQUIRED = {
    CTM_API_BASE_URL: 'http://localhost:3000',
    CTM_PUBLIC_URL: 'http://localhost:3000',
    MCP_PUBLIC_URL: 'http://localhost:3002',
    RSA_PUBLIC_KEY: 'dGVzdA==',
    PORT: '3002',
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
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
