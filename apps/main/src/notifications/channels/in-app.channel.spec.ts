import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { InAppChannel } from './in-app.channel.js';
import { Notification } from '../schemas/notification.schema.js';

describe('InAppChannel', () => {
    let channel: InAppChannel;
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockCreate = vi.fn().mockResolvedValue({});
        const module = await Test.createTestingModule({
            providers: [
                InAppChannel,
                { provide: getModelToken(Notification.name), useValue: { create: mockCreate } },
            ],
        }).compile();

        channel = module.get(InAppChannel);
    });

    it('creates a notification document with read=false', async () => {
        const userId = new Types.ObjectId().toHexString();
        await channel.send({ userId, type: 'daily_summary', title: 'Test', body: 'Body' });

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'daily_summary',
                title: 'Test',
                body: 'Body',
                read: false,
            }),
        );
    });

    it('converts userId string to ObjectId', async () => {
        const userId = new Types.ObjectId().toHexString();
        await channel.send({ userId, type: 'reminder', title: 'T', body: 'B' });

        const arg = mockCreate.mock.calls[0][0] as { userId: Types.ObjectId };
        expect(arg.userId).toBeInstanceOf(Types.ObjectId);
        expect(arg.userId.toHexString()).toBe(userId);
    });
});
