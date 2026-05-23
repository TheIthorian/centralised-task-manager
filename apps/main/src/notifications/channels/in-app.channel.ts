import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, type NotificationDocument } from '../schemas/notification.schema.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

@Injectable()
export class InAppChannel {
    constructor(@InjectModel(Notification.name) private readonly model: Model<NotificationDocument>) {}

    /** Write a notification to the user's in-app inbox. */
    async send({ userId, type, title, body }: SendNotificationDto): Promise<void> {
        await this.model.create({ userId: new Types.ObjectId(userId), type, title, body, read: false });
    }
}
