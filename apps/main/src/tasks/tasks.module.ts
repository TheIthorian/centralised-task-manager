import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Task, TaskSchema, type TaskDocument } from '@ctm/db';
import { TasksService } from '@ctm/domain';
import { TasksController } from './tasks.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { appLogger } from '../logging/app-logger.js';

@Module({
    imports: [MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]), AuthModule, UsersModule],
    controllers: [TasksController],
    providers: [
        {
            // TasksService is a plain class so it stays callable outside Nest; the app decides
            // which model, and therefore which connection, it runs against.
            provide: TasksService,
            inject: [getModelToken(Task.name)],
            useFactory: (taskModel: Model<TaskDocument>): TasksService =>
                new TasksService({
                    taskModel,
                    onTransactionsUnavailable: () =>
                        appLogger(TasksService.name).warn(
                            'MongoDB has no replica set, so relation and delete writes are not atomic',
                        ),
                }),
        },
    ],
    exports: [TasksService],
})
export class TasksModule {}
