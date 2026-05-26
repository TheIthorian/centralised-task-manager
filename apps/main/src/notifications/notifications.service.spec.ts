import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model } from 'mongoose';
import { NotificationsService } from './notifications.service.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
import { User, UserSchema, type UserDocument } from '../users/schemas/user.schema.js';
import { Notification, NotificationSchema } from './schemas/notification.schema.js';

describe('NotificationsService', () => {
    let module: TestingModule;
    let service: NotificationsService;
    let userModel: Model<UserDocument>;
    let inApp: { send: ReturnType<typeof vi.fn> };
    let email: { send: ReturnType<typeof vi.fn> };
    let discord: { send: ReturnType<typeof vi.fn> };

    beforeAll(async () => {
        inApp = { send: vi.fn().mockResolvedValue(undefined) };
        email = { send: vi.fn().mockResolvedValue(undefined) };
        discord = { send: vi.fn().mockResolvedValue(undefined) };

        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([
                    { name: User.name, schema: UserSchema },
                    { name: Notification.name, schema: NotificationSchema },
                ]),
            ],
            providers: [
                NotificationsService,
                { provide: InAppChannel, useValue: inApp },
                { provide: EmailChannel, useValue: email },
                { provide: DiscordChannel, useValue: discord },
            ],
        }).compile();

        service = module.get(NotificationsService);
        userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
    });

    afterAll(async () => {
        await module.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        inApp.send.mockResolvedValue(undefined);
        email.send.mockResolvedValue(undefined);
        discord.send.mockResolvedValue(undefined);
    });

    it('sends to inApp when inApp pref is true', async () => {
        const user = await userModel.create({
            email: `notif-inapp-${Date.now()}@test.com`,
            passwordHash: 'hash',
            notificationPreferences: { dailySummary: { inApp: true, discord: false, email: false } },
        });

        await service.send({ userId: String(user._id), type: 'daily_summary', data: { type: 'daily_summary' }, title: 'T', body: 'B' });

        expect(inApp.send).toHaveBeenCalledOnce();
        expect(email.send).not.toHaveBeenCalled();
        expect(discord.send).not.toHaveBeenCalled();
    });

    it('skips inApp when inApp pref is false', async () => {
        const user = await userModel.create({
            email: `notif-skip-inapp-${Date.now()}@test.com`,
            passwordHash: 'hash',
            notificationPreferences: { dailySummary: { inApp: false, discord: false, email: false } },
        });

        await service.send({ userId: String(user._id), type: 'daily_summary', data: { type: 'daily_summary' }, title: 'T', body: 'B' });

        expect(inApp.send).not.toHaveBeenCalled();
    });

    it('sends to discord when discord pref is true', async () => {
        const user = await userModel.create({
            email: `notif-discord-${Date.now()}@test.com`,
            passwordHash: 'hash',
            notificationPreferences: { reminder: { inApp: false, discord: true, email: false } },
        });

        await service.send({ userId: String(user._id), type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        expect(discord.send).toHaveBeenCalledOnce();
    });

    it('sends inApp connector_reconnect notification when Discord token expires', async () => {
        const user = await userModel.create({
            email: `notif-discord-expire-${Date.now()}@test.com`,
            passwordHash: 'hash',
            notificationPreferences: { reminder: { inApp: false, discord: true, email: false } },
        });
        discord.send.mockRejectedValue(new DiscordAuthExpiredError());

        await service.send({ userId: String(user._id), type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        expect(inApp.send).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'connector_reconnect' }),
        );
    });

    it('continues to email channel even if inApp fails', async () => {
        const user = await userModel.create({
            email: `notif-email-fallback-${Date.now()}@test.com`,
            passwordHash: 'hash',
            notificationPreferences: { reminder: { inApp: true, discord: false, email: true } },
        });
        inApp.send.mockRejectedValue(new Error('DB down'));

        await service.send({ userId: String(user._id), type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        expect(email.send).toHaveBeenCalledOnce();
    });

    it('is a no-op when user is not found', async () => {
        await service.send({ userId: '000000000000000000000000', type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        expect(inApp.send).not.toHaveBeenCalled();
    });
});
