import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema.js';
import { DiscordConnection, DiscordConnectionSchema } from '../connectors/schemas/discord-connection.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel } from './channels/discord.channel.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: DiscordConnection.name, schema: DiscordConnectionSchema },
            { name: User.name, schema: UserSchema },
        ]),
        UsersModule,
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, InAppChannel, EmailChannel, DiscordChannel],
    exports: [NotificationsService],
})
export class NotificationsModule {}
