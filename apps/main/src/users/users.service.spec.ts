import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ValidationError } from '@ctm/errors';
import { UsersService } from './users.service.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';

describe('UsersService — notification preferences', () => {
    let module: TestingModule;
    let service: UsersService;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
                    { name: Task.name, schema: TaskSchema },
                ]),
            ],
            providers: [UsersService],
        }).compile();

        service = module.get(UsersService);
    });

    afterAll(async () => {
        await module.close();
    });

    it('getNotificationPreferences returns prefs for existing user', async () => {
        const user = await service.create({ email: `prefs-get-${Date.now()}@test.com`, password: 'pw' });
        const result = await service.getNotificationPreferences(String(user._id));

        expect(result).toMatchObject({ connectorReconnect: expect.any(Object) });
    });

    it('getNotificationPreferences returns null when user not found', async () => {
        const result = await service.getNotificationPreferences('000000000000000000000000');

        expect(result).toBeNull();
    });

    it('updateNotificationPreferences patches specified trigger channels via $set', async () => {
        const user = await service.create({ email: `prefs-update-${Date.now()}@test.com`, password: 'pw' });
        const result = await service.updateNotificationPreferences({
            userId: String(user._id),
            prefs: { dailySummary: { discord: true, inApp: false } },
        });

        expect(result?.dailySummary).toMatchObject({ discord: true, inApp: false });
    });

    it('updateNotificationPreferences throws NotFoundException when user not found', async () => {
        await expect(
            service.updateNotificationPreferences({ userId: '000000000000000000000000', prefs: {} }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('defaults a new user to UTC rather than the server zone', async () => {
        const user = await service.create({ email: `tz-default-${Date.now()}@test.com`, password: 'pw' });

        expect(user.timezone).toBe('UTC');
        expect(await service.getTimeZone(String(user._id))).toBe('UTC');
    });

    it('stores a timezone the caller sends', async () => {
        const user = await service.create({ email: `tz-set-${Date.now()}@test.com`, password: 'pw' });

        await service.update({ id: String(user._id), dto: { timezone: 'Pacific/Auckland' } });

        expect(await service.getTimeZone(String(user._id))).toBe('Pacific/Auckland');
    });

    it('refuses a timezone this runtime cannot resolve', async () => {
        const user = await service.create({ email: `tz-bad-${Date.now()}@test.com`, password: 'pw' });

        await expect(
            service.update({ id: String(user._id), dto: { timezone: 'Mars/Olympus' } }),
        ).rejects.toBeInstanceOf(ValidationError);
    });

    it('falls back to UTC for a user that does not exist', async () => {
        expect(await service.getTimeZone('000000000000000000000000')).toBe('UTC');
    });
});
