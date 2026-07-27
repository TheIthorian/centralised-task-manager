import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RateLimitError } from '@ctm/errors';
import { LoginAttempt, type LoginAttemptDocument } from './schemas/login-attempt.schema.js';

const MINUTE_MS = 60_000;

/**
 * Tracks consecutive failed logins per account and locks the account for a cooldown once
 * the threshold is reached. IP-keyed throttling alone cannot stop a password spray spread
 * across many addresses, so the counter is keyed on the account.
 */
@Injectable()
export class LoginAttemptsService {
    constructor(
        @InjectModel(LoginAttempt.name) private readonly attemptModel: Model<LoginAttemptDocument>,
        private readonly config: ConfigService,
    ) {}

    /** Throw a `RateLimitError` when the account is inside its lockout window. */
    async assertNotLocked(email: string): Promise<void> {
        const record = await this.attemptModel.findOne({ email: this.normalize(email) });
        const lockedUntil = record?.lockedUntil;

        if (!lockedUntil || lockedUntil.getTime() <= Date.now()) return;

        throw new RateLimitError({
            message: 'Too many failed login attempts. Try again later.',
            retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)),
        });
    }

    /** Record a failed login, locking the account once the failure threshold is reached. */
    async recordFailure(email: string): Promise<void> {
        const windowMs = this.config.getOrThrow<number>('LOGIN_LOCKOUT_MINUTES') * MINUTE_MS;
        const maxAttempts = this.config.getOrThrow<number>('LOGIN_MAX_FAILED_ATTEMPTS');
        const now = Date.now();

        const record = await this.attemptModel.findOneAndUpdate(
            { email: this.normalize(email) },
            { $inc: { failedCount: 1 }, $set: { expiresAt: new Date(now + windowMs) } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        );

        if (record.failedCount < maxAttempts) return;

        const lockedUntil = new Date(now + windowMs);

        // expiresAt doubles as the TTL, so it must not drop the row before the lock lifts.
        await this.attemptModel.updateOne(
            { _id: record._id },
            { $set: { lockedUntil, expiresAt: lockedUntil, failedCount: 0 } },
        );
    }

    /** Clear the failure counter after a successful login. */
    async clear(email: string): Promise<void> {
        await this.attemptModel.deleteOne({ email: this.normalize(email) });
    }

    private normalize(email: string): string {
        return email.trim().toLowerCase();
    }
}
