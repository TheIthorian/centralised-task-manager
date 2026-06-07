import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema.js';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]), AuthModule, UsersModule],
    controllers: [TasksController],
    providers: [TasksService],
    exports: [TasksService],
})
export class TasksModule {}
