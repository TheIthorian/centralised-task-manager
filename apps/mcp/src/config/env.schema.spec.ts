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

    it.each(['LOG_LEVEL', 'LOG_PRETTY', 'LOG_REDACT'])('rejects a missing %s rather than defaulting', (name) => {
        const { [name]: _omitted, ...withoutVar } = validEnv;

        const { error } = envSchema.validate(withoutVar);

        expect(error?.message).toContain(`"${name}" is required`);
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
