import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthorizedError } from '@ctm/errors';
import { AuditAction, AuditTargetType } from '@ctm/db';
import { AuditService } from '../audit/audit.service.js';
import { ADMIN_TOKEN_AUDIENCE, type AdminSessionClaims } from './admin-session.js';
import { AdminLoginAttemptsService } from './admin-login-attempts.service.js';

/** A freshly minted admin session. */
export type AdminSession = {
    token: string;
    expiresInSeconds: number;
};

@Injectable()
export class AdminAuthService {
    constructor(
        private readonly config: ConfigService,
        private readonly jwt: JwtService,
        private readonly attempts: AdminLoginAttemptsService,
        private readonly audit: AuditService,
    ) {}

    /**
     * Check the operator credential and mint a session token.
     *
     * @throws RateLimitError when the credential is locked out.
     * @throws UnauthorizedError when either the username or the password is wrong.
     */
    async login({
        username,
        password,
        ip,
    }: {
        username: string;
        password: string;
        ip: string | null;
    }): Promise<AdminSession> {
        const expectedUsername = this.config.getOrThrow<string>('ADMIN_USERNAME');

        await this.attempts.assertNotLocked(expectedUsername);

        // Both comparisons run before either result is read, so a wrong username and a wrong
        // password take the same time and neither can be probed independently.
        const usernameMatches = timingSafeEquals(username, expectedUsername);
        const passwordMatches = await bcrypt.compare(password, this.config.getOrThrow<string>('ADMIN_PASSWORD_HASH'));

        if (!usernameMatches || !passwordMatches) {
            await this.attempts.recordFailure(expectedUsername);
            await this.audit.record({
                action: AuditAction.AdminLoginFailed,
                actor: expectedUsername,
                targetType: AuditTargetType.Session,
                ip,
            });

            throw new UnauthorizedError('Invalid credentials');
        }

        await this.attempts.clear(expectedUsername);
        await this.audit.record({
            action: AuditAction.AdminLoggedIn,
            actor: expectedUsername,
            targetType: AuditTargetType.Session,
            ip,
        });

        const expiresInSeconds = this.config.getOrThrow<number>('ADMIN_SESSION_EXPIRES_MINUTES') * 60;
        const claims: AdminSessionClaims = { sub: expectedUsername, aud: ADMIN_TOKEN_AUDIENCE };

        return { token: this.jwt.sign(claims, { expiresIn: expiresInSeconds }), expiresInSeconds };
    }

    /**
     * Verify a session token from the cookie.
     *
     * @throws UnauthorizedError when the token is absent, expired, or not an admin token.
     */
    verifySession(token: string | undefined): AdminSessionClaims {
        if (!token) throw new UnauthorizedError('Not authenticated');

        try {
            return this.jwt.verify<AdminSessionClaims>(token, { audience: ADMIN_TOKEN_AUDIENCE });
        } catch {
            throw new UnauthorizedError('Session is invalid or has expired');
        }
    }
}

// Compares without leaking the position of the first difference through timing. Length is not
// secret here: the expected username comes from configuration, not from the request.
function timingSafeEquals(candidate: string, expected: string): boolean {
    let mismatch = candidate.length === expected.length ? 0 : 1;

    for (let i = 0; i < candidate.length; i++) {
        mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i % expected.length);
    }

    return mismatch === 0;
}
