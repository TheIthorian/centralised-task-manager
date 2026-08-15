import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Export, ExportSchema, Notification, NotificationSchema, Task, TaskSchema, User, UserSchema } from '@ctm/db';
import { FilesModule } from '../files/files.module.js';
import { ExportService } from './export.service.js';
import { ImportService } from './import.service.js';
import { DataPortabilityController } from './data-portability.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

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
        UsersModule,
    ],
    controllers: [DataPortabilityController],
    providers: [ExportService, ImportService],
})
export class DataPortabilityModule {}
