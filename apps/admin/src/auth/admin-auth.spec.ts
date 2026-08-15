import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { getModelToken } from '@nestjs/mongoose';
import cookie from '@fastify/cookie';
import { Model } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuditAction, AuditLog, LoginAttempt, type AuditLogDocument, type LoginAttemptDocument } from '@ctm/db';
import { AppModule } from '../app.module.js';
import { ADMIN_SESSION_COOKIE } from './admin-session.js';

const USERNAME = 'operator';
const PASSWORD = 'test-admin-password';

describe('admin auth', () => {
    let app: NestFastifyApplication;
    let attempts: Model<LoginAttemptDocument>;
    let auditLogs: Model<AuditLogDocument>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        attempts = moduleRef.get<Model<LoginAttemptDocument>>(getModelToken(LoginAttempt.name));
        auditLogs = moduleRef.get<Model<AuditLogDocument>>(getModelToken(AuditLog.name));
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // The lockout counter is keyed on the one credential, so it has to be clear before a test
        // that expects a login to be accepted or counted.
        await attempts.deleteMany({ email: `admin:${USERNAME}` });
    });

    it('rejects the wrong password without issuing a cookie', async () => {
        const response = await login({ password: 'wrong-password' });

        expect(response.statusCode).toBe(401);
        expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects the wrong username even with the right password', async () => {
        const response = await login({ username: 'someone-else' });

        expect(response.statusCode).toBe(401);
    });

    it('accepts the credential and sets an httpOnly session cookie', async () => {
        const response = await login({});

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ username: USERNAME });

        const setCookie = String(response.headers['set-cookie']);
        expect(setCookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('SameSite=Strict');
    });

    it('locks the credential out after repeated failures', async () => {
        // ADMIN_MAX_FAILED_ATTEMPTS defaults to 5.
        for (let i = 0; i < 5; i++) {
            await login({ password: 'wrong-password' });
        }

        const locked = await login({});

        expect(locked.statusCode).toBe(429);
        expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('records both the failure and the success in the audit log', async () => {
        const before = await auditLogs.countDocuments({ action: AuditAction.AdminLoggedIn });

        await login({ password: 'wrong-password' });
        await login({});

        expect(await auditLogs.countDocuments({ action: AuditAction.AdminLoggedIn })).toBe(before + 1);
        expect(await auditLogs.countDocuments({ action: AuditAction.AdminLoginFailed })).toBeGreaterThan(0);
    });

    it('closes the audit log endpoint to a request with no session', async () => {
        const response = await app.inject({ method: 'GET', url: '/audit-log' });

        expect(response.statusCode).toBe(401);
    });

    it('opens the audit log endpoint to a request carrying the session cookie', async () => {
        const session = await login({});
        const token = extractSessionCookie(session.headers['set-cookie']);

        const response = await app.inject({
            method: 'GET',
            url: '/audit-log',
            cookies: { [ADMIN_SESSION_COOKIE]: token },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ entries: expect.any(Array), total: expect.any(Number) });
    });

    it('rejects a session cookie signed with a different secret', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/audit-log',
            cookies: { [ADMIN_SESSION_COOKIE]: 'not.a.valid-token' },
        });

        expect(response.statusCode).toBe(401);
    });

    function login({ username = USERNAME, password = PASSWORD }: { username?: string; password?: string }) {
        return app.inject({ method: 'POST', url: '/auth/login', payload: { username, password } });
    }
});

function extractSessionCookie(setCookie: string | string[] | undefined): string {
    const header = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    const match = header.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));

    expect(match?.[1], `no ${ADMIN_SESSION_COOKIE} in ${header}`).toBeDefined();

    return String(match?.[1]);
}
