import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema.js';

const VALID = {
    MONGODB_URI: 'mongodb://localhost:27017/ctm',
    MONGODB_IDLE_TIMEOUT_MS: '60000',
    PORT: '3100',
    NODE_ENV: 'production',
    CF_ACCESS_TEAM_DOMAIN: 'ctm.cloudflareaccess.com',
    CF_ACCESS_AUD: '0000000000000000000000000000000000000000000000000000000000000000',
    ADMIN_WEB_URL: 'https://admin.example.com',
    LOG_LEVEL: 'info',
};

describe('admin envSchema', () => {
    it('accepts a complete production environment', () => {
        expect(envSchema.validate(VALID).error).toBeUndefined();
    });

    it('refuses to boot production with the auth bypass set', () => {
        const { error } = envSchema.validate({ ...VALID, ADMIN_DEV_BYPASS_EMAIL: 'me@example.com' });

        expect(error?.message).toMatch(/ADMIN_DEV_BYPASS_EMAIL must never be set when NODE_ENV=production/);
    });

    it('allows the bypass outside production', () => {
        const { error } = envSchema.validate({
            ...VALID,
            NODE_ENV: 'development',
            ADMIN_DEV_BYPASS_EMAIL: 'me@example.com',
        });

        expect(error).toBeUndefined();
    });

    it('requires the Access audience, without which any team token would verify', () => {
        const { CF_ACCESS_AUD: _omitted, ...withoutAud } = VALID;

        expect(envSchema.validate(withoutAud).error?.message).toMatch(/CF_ACCESS_AUD/);
    });

    it('requires the Access team domain', () => {
        const { CF_ACCESS_TEAM_DOMAIN: _omitted, ...withoutTeam } = VALID;

        expect(envSchema.validate(withoutTeam).error?.message).toMatch(/CF_ACCESS_TEAM_DOMAIN/);
    });

    it('requires the SPA origin, because the Access cookie is credentialed', () => {
        const { ADMIN_WEB_URL: _omitted, ...withoutOrigin } = VALID;

        expect(envSchema.validate(withoutOrigin).error?.message).toMatch(/ADMIN_WEB_URL/);
    });

    it('refuses to boot production with redaction off', () => {
        const { error } = envSchema.validate({ ...VALID, LOG_REDACT: 'false' });

        expect(error?.message).toMatch(/LOG_REDACT must be true when NODE_ENV=production/);
    });
});
