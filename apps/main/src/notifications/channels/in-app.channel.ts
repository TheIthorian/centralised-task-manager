import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, type NotificationDocument } from '@ctm/db';
import { NotificationsGateway } from '../notifications.gateway.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

@Injectable()
export class InAppChannel {
    constructor(
        @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
        private readonly gateway: NotificationsGateway,
    ) {}

    /** Write a notification to the user's in-app inbox and push it via WebSocket. */
    async send({ userId, type, data, title, body }: SendNotificationDto): Promise<void> {
        const doc = await this.model.create({
            userId: new Types.ObjectId(userId),
            type,
            data,
            title,
            body,
            read: false,
        });

        this.gateway.sendNotification({
            userId,
            notification: {
                id: String(doc._id),
                type,
                data: data ?? { type },
                title,
                body,
                read: false,
                createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
            },
        });
    }
}
