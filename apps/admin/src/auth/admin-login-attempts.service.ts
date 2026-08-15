import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RateLimitError } from '@ctm/errors';
import { LoginAttempt, type LoginAttemptDocument } from '@ctm/db';

const MINUTE_MS = 60_000;

// The shared LoginAttempt collection is keyed by `email`. Admin rows are namespaced so the single
// operator credential can never collide with an app user who happens to share the name.
const ADMIN_KEY_PREFIX = 'admin:';

/**
 * Tracks consecutive failed admin logins and locks the credential for a cooldown once the
 * threshold is reached. There is one credential, so the counter is the whole rate limit.
 */
@Injectable()
export class AdminLoginAttemptsService {
    constructor(
        @InjectModel(LoginAttempt.name) private readonly attemptModel: Model<LoginAttemptDocument>,
        private readonly config: ConfigService,
    ) {}

    /** Throw a `RateLimitError` when the credential is inside its lockout window. */
    async assertNotLocked(username: string): Promise<void> {
        const record = await this.attemptModel.findOne({ email: this.key(username) });
        const lockedUntil = record?.lockedUntil;

        if (!lockedUntil || lockedUntil.getTime() <= Date.now()) return;

        throw new RateLimitError({
            message: 'Too many failed login attempts. Try again later.',
            retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)),
        });
    }

    /** Record a failed login, locking the credential once the failure threshold is reached. */
    async recordFailure(username: string): Promise<void> {
        const windowMs = this.config.getOrThrow<number>('ADMIN_LOCKOUT_MINUTES') * MINUTE_MS;
        const maxAttempts = this.config.getOrThrow<number>('ADMIN_MAX_FAILED_ATTEMPTS');
        const now = Date.now();

        const record = await this.attemptModel.findOneAndUpdate(
            { email: this.key(username) },
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
    async clear(username: string): Promise<void> {
        await this.attemptModel.deleteOne({ email: this.key(username) });
    }

    private key(username: string): string {
        return `${ADMIN_KEY_PREFIX}${username.trim().toLowerCase()}`;
    }
}
