import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { InAppChannel } from './in-app.channel.js';
import { Notification, NotificationSchema, type NotificationDocument } from '../schemas/notification.schema.js';

describe('InAppChannel', () => {
    let module: TestingModule;
    let channel: InAppChannel;
    let notificationModel: Model<NotificationDocument>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/ctm-test'),
                MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
            ],
            providers: [InAppChannel],
        }).compile();

        channel = module.get(InAppChannel);
        notificationModel = module.get<Model<NotificationDocument>>(getModelToken(Notification.name));
    });

    afterAll(async () => {
        await module.close();
    });

    it('creates a notification document with read=false', async () => {
        const userId = new Types.ObjectId().toHexString();
        await channel.send({ userId, type: 'daily_summary', title: 'Test', body: 'Body' });

        const doc = await notificationModel.findOne({ userId: new Types.ObjectId(userId), type: 'daily_summary' });

        expect(doc).not.toBeNull();
        expect(doc?.title).toBe('Test');
        expect(doc?.body).toBe('Body');
        expect(doc?.read).toBe(false);
    });

    it('converts userId string to ObjectId', async () => {
        const userId = new Types.ObjectId().toHexString();
        await channel.send({ userId, type: 'reminder', title: 'T', body: 'B' });

        const doc = await notificationModel.findOne({ userId: new Types.ObjectId(userId), type: 'reminder' });

        expect(doc?.userId).toBeInstanceOf(Types.ObjectId);
        expect(doc?.userId.toHexString()).toBe(userId);
    });
});
