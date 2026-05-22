import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
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
