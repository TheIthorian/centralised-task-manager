import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectorConfig, ConnectorConfigSchema, Task, TaskSchema } from '@ctm/db';
import { RemindersService } from './reminders.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Task.name, schema: TaskSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
        ]),
        NotificationsModule,
    ],
    providers: [RemindersService],
    exports: [RemindersService],
})
export class RemindersModule {}
