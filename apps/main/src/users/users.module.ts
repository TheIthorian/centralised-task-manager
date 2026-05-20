import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: Task.name, schema: TaskSchema },
        ]),
        forwardRef(() => AuthModule),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
