import { Injectable, Logger } from '@nestjs/common';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

@Injectable()
export class EmailChannel {
    private readonly logger = new Logger(EmailChannel.name);

    /** Mock email channel — logs only. Replace with real transport in production. */
    async send({ userId, type, title }: SendNotificationDto): Promise<void> {
        this.logger.log(`[mock-email] userId=${userId} type=${type} title="${title}"`);
    }
}
