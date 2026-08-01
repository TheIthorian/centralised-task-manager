import { Injectable } from '@nestjs/common';
import { createLogger } from '@ctm/logger';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

@Injectable()
export class EmailChannel {
    private readonly logger = createLogger(EmailChannel.name);

    /** Mock email channel — logs only. Replace with real transport in production. */
    async send({ userId, type }: SendNotificationDto): Promise<void> {
        // The title is user content and the body may quote a task, so neither is logged.
        this.logger.info({ userId, type, channel: 'email', mock: true }, 'Notification delivered');
    }
}
