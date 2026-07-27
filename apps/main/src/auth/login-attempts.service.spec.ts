import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import { RateLimitError } from '@ctm/errors';
import { beforeAll, describe, expect, it } from 'vitest';
import { LoginAttemptsService } from './login-attempts.service.js';
import { LoginAttempt, LoginAttemptSchema, type LoginAttemptDocument } from './schemas/login-attempt.schema.js';

const MAX_ATTEMPTS = Number(process.env['LOGIN_MAX_FAILED_ATTEMPTS']);

describe('LoginAttemptsService', () => {
    let service: LoginAttemptsService;
    let model: Model<LoginAttemptDocument>;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: LoginAttempt.name, schema: LoginAttemptSchema }]),
            ],
            providers: [LoginAttemptsService],
        }).compile();

        service = moduleRef.get(LoginAttemptsService);
        model = moduleRef.get<Model<LoginAttemptDocument>>(getModelToken(LoginAttempt.name));
    });

    it('does not lock an account below the failure threshold', async () => {
        const email = `attempts+under-${Date.now()}@example.com`;

        for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
            await service.recordFailure(email);
        }

        await expect(service.assertNotLocked(email)).resolves.toBeUndefined();
    });

    it('locks the account once the threshold is reached', async () => {
        const email = `attempts+lock-${Date.now()}@example.com`;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await service.recordFailure(email);
        }

        await expect(service.assertNotLocked(email)).rejects.toBeInstanceOf(RateLimitError);
    });

    it('treats the email case-insensitively', async () => {
        const email = `attempts+case-${Date.now()}@example.com`;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await service.recordFailure(email.toUpperCase());
        }

        await expect(service.assertNotLocked(email)).rejects.toBeInstanceOf(RateLimitError);
    });

    it('keeps the row alive for as long as the lock lasts', async () => {
        const email = `attempts+ttl-${Date.now()}@example.com`;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await service.recordFailure(email);
        }

        const record = await model.findOne({ email });

        expect(record?.expiresAt.getTime()).toBe(record?.lockedUntil?.getTime());
    });

    it('clears the counter after a successful login', async () => {
        const email = `attempts+clear-${Date.now()}@example.com`;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await service.recordFailure(email);
        }

        await service.clear(email);

        await expect(service.assertNotLocked(email)).resolves.toBeUndefined();
    });
});
