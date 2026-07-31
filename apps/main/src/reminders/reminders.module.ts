import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { RemindersService } from './reminders.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Task.name, schema: TaskSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: User.name, schema: UserSchema },
        ]),
        NotificationsModule,
        UsersModule,
    ],
    providers: [RemindersService],
    exports: [RemindersService],
})
export class RemindersModule {}
