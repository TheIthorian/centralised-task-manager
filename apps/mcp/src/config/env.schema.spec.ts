import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema.js';

describe('envSchema', () => {
    const validEnv = {
        CTM_API_BASE_URL: 'http://localhost:3000',
        CTM_PUBLIC_URL: 'http://localhost:3000',
        MCP_PUBLIC_URL: 'http://localhost:3002',
        RSA_PUBLIC_KEY: 'dGVzdA==',
        PORT: 3002,
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        LOG_PRETTY: false,
        LOG_REDACT: true,
    };

    it('accepts valid env', () => {
        const { error } = envSchema.validate(validEnv);

        expect(error).toBeUndefined();
    });

    it('rejects a missing LOG_LEVEL rather than defaulting', () => {
        const { LOG_LEVEL: _omitted, ...withoutLevel } = validEnv;

        const { error } = envSchema.validate(withoutLevel);

        expect(error?.message).toContain('"LOG_LEVEL" is required');
    });

    it('defaults the two switches to the safe end when they are absent', () => {
        const { LOG_PRETTY: _pretty, LOG_REDACT: _redact, ...withoutSwitches } = validEnv;

        const { error, value } = envSchema.validate(withoutSwitches);

        expect(error).toBeUndefined();
        expect(value).toMatchObject({ LOG_PRETTY: false, LOG_REDACT: true });
    });

    it.each(['LOG_PRETTY', 'LOG_REDACT'])('still rejects an unparseable %s', (name) => {
        const { error } = envSchema.validate({ ...validEnv, [name]: 'flase' });

        expect(error?.message).toContain(`"${name}" must be a boolean`);
    });

    it('applies the production guards to a defaulted switch', () => {
        const { LOG_PRETTY: _pretty, LOG_REDACT: _redact, ...withoutSwitches } = validEnv;

        const { error, value } = envSchema.validate({ ...withoutSwitches, NODE_ENV: 'production' });

        expect(error).toBeUndefined();
        expect(value).toMatchObject({ LOG_PRETTY: false, LOG_REDACT: true });
    });

    it('rejects a log level pino does not have', () => {
        const { error } = envSchema.validate({ ...validEnv, LOG_LEVEL: 'verbose' });

        expect(error?.message).toContain('"LOG_LEVEL" must be one of');
    });

    it('refuses to boot production with redaction switched off', () => {
        const { error } = envSchema.validate({ ...validEnv, NODE_ENV: 'production', LOG_REDACT: false });

        expect(error?.message).toContain('LOG_REDACT must be true when NODE_ENV=production');
    });

    it('refuses to boot production with pretty printing switched on', () => {
        const { error } = envSchema.validate({ ...validEnv, NODE_ENV: 'production', LOG_PRETTY: true });

        expect(error?.message).toContain('LOG_PRETTY must be false when NODE_ENV=production');
    });

    it('allows redaction off and pretty on away from production', () => {
        const { error } = envSchema.validate({
            ...validEnv,
            NODE_ENV: 'development',
            LOG_PRETTY: true,
            LOG_REDACT: false,
        });

        expect(error).toBeUndefined();
    });
});
