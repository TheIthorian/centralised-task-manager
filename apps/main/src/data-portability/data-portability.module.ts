import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema.js';
import { Export, ExportSchema } from './schemas/export.schema.js';
import { FilesModule } from '../files/files.module.js';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { DataPortabilityController } from './data-portability.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Task.name, schema: TaskSchema },
            { name: Notification.name, schema: NotificationSchema },
            { name: Export.name, schema: ExportSchema },
        ]),
        FilesModule,
        AuthModule,
    ],
    controllers: [DataPortabilityController],
    providers: [ExportService, ImportService],
})
export class DataPortabilityModule {}
