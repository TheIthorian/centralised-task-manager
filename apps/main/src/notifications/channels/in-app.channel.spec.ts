import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { InAppChannel } from './in-app.channel.js';
import { NotificationsGateway } from '../notifications.gateway.js';
import { Notification, NotificationSchema, type NotificationDocument } from '@ctm/db';

describe('InAppChannel', () => {
    let module: TestingModule;
    let channel: InAppChannel;
    let notificationModel: Model<NotificationDocument>;
    let mockGateway: { sendNotification: ReturnType<typeof vi.fn> };

    beforeAll(async () => {
        mockGateway = { sendNotification: vi.fn() };

        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
            ],
            providers: [InAppChannel, { provide: NotificationsGateway, useValue: mockGateway }],
        }).compile();

        channel = module.get(InAppChannel);
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('creates a notification document with read=false', async () => {
        const userId = new Types.ObjectId().toHexString();

        await channel.send({
            userId,
            type: 'daily_summary',
            data: { type: 'daily_summary' },
            title: 'Test',
            body: 'Body',
        });

        const doc = await notificationModel.findOne({ userId: new Types.ObjectId(userId), type: 'daily_summary' });

        expect(doc).not.toBeNull();
        expect(doc?.title).toBe('Test');
        expect(doc?.body).toBe('Body');
        expect(doc?.read).toBe(false);
    });

    it('converts userId string to ObjectId', async () => {
        const userId = new Types.ObjectId().toHexString();

        await channel.send({ userId, type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        const doc = await notificationModel.findOne({ userId: new Types.ObjectId(userId), type: 'reminder' });

        expect(doc?.userId).toBeInstanceOf(Types.ObjectId);
        expect(doc?.userId.toHexString()).toBe(userId);
    });

    it('calls gateway.sendNotification after persisting', async () => {
        const userId = new Types.ObjectId().toHexString();

        await channel.send({ userId, type: 'reminder', data: { type: 'reminder' }, title: 'T', body: 'B' });

        expect(mockGateway.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId,
                notification: expect.objectContaining({ type: 'reminder', read: false }),
            }),
        );
    });
});
