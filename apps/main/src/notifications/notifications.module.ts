import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscordMessageClient } from '@ctm/connectors';
import { HttpClient } from '@ctm/http-client';
import { Notification, NotificationSchema } from './schemas/notification.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel } from './channels/discord.channel.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: User.name, schema: UserSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
        ]),
        UsersModule,
        AuthModule,
    ],
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationsGateway,
        InAppChannel,
        EmailChannel,
        DiscordChannel,
        {
            provide: DiscordMessageClient,
            useFactory: () => new DiscordMessageClient(new HttpClient({ baseUrl: 'https://discord.com/api/v10' })),
        },
    ],
    exports: [NotificationsService],
})
export class NotificationsModule {}
