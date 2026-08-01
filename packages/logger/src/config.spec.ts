import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '@ctm/errors';
import { assertSafeInProduction, readLoggerConfig } from './config.js';

const validEnv = { LOG_LEVEL: 'info', LOG_PRETTY: 'false', LOG_REDACT: 'true', NODE_ENV: 'production' };

describe('readLoggerConfig', () => {
    it('reads all three settings from the environment', () => {
        expect(readLoggerConfig({ ...validEnv, LOG_LEVEL: 'debug' })).toEqual({
            level: 'debug',
            pretty: false,
            redact: true,
        });
    });

    it.each(['LOG_LEVEL', 'LOG_PRETTY', 'LOG_REDACT'])('fails when %s is missing', (name) => {
        const env = { ...validEnv, [name]: undefined };

        expect(() => readLoggerConfig(env)).toThrow(ConfigurationError);
        expect(() => readLoggerConfig(env)).toThrow(new RegExp(`${name} is required`));
    });

    it.each(['LOG_LEVEL', 'LOG_PRETTY', 'LOG_REDACT'])('fails when %s is empty rather than defaulting', (name) => {
        expect(() => readLoggerConfig({ ...validEnv, [name]: '' })).toThrow(ConfigurationError);
    });

    it('fails on a log level pino does not have', () => {
        expect(() => readLoggerConfig({ ...validEnv, LOG_LEVEL: 'verbose' })).toThrow(/must be one of/);
        expect(() => readLoggerConfig({ ...validEnv, LOG_LEVEL: 'INFO' })).toThrow(/Received 'INFO'/);
    });

    it.each(['1', 'yes', 'TRUE', 'on'])('rejects %s as a boolean rather than guessing', (value) => {
        expect(() => readLoggerConfig({ ...validEnv, LOG_PRETTY: value })).toThrow(/must be 'true' or 'false'/);
    });

    it('never derives anything from NODE_ENV', () => {
        const development = { LOG_LEVEL: 'error', LOG_PRETTY: 'false', LOG_REDACT: 'true', NODE_ENV: 'development' };

        expect(readLoggerConfig(development)).toEqual({ level: 'error', pretty: false, redact: true });
    });

    it('allows pretty, unredacted output away from production', () => {
        const local = { LOG_LEVEL: 'debug', LOG_PRETTY: 'true', LOG_REDACT: 'false', NODE_ENV: 'development' };

        expect(readLoggerConfig(local)).toEqual({ level: 'debug', pretty: true, redact: false });
    });
});

describe('assertSafeInProduction', () => {
    it('refuses to boot production with pretty output', () => {
        expect(() => assertSafeInProduction({ nodeEnv: 'production', pretty: true, redact: true })).toThrow(
            /LOG_PRETTY must be false when NODE_ENV=production/,
        );
    });

    it('refuses to boot production with redaction off, and says why', () => {
        expect(() => assertSafeInProduction({ nodeEnv: 'production', pretty: false, redact: false })).toThrow(
            /access tokens, passwords, cookies and OAuth codes/,
        );
    });

    it('leaves every other NODE_ENV alone', () => {
        expect(() => assertSafeInProduction({ nodeEnv: 'development', pretty: true, redact: false })).not.toThrow();
        expect(() => assertSafeInProduction({ nodeEnv: undefined, pretty: true, redact: false })).not.toThrow();
    });
});
