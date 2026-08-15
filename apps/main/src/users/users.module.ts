import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConnectorConfig, ConnectorConfigSchema, Task, TaskSchema, User, UserSchema } from '@ctm/db';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { TokensModule } from '../tokens/tokens.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: Task.name, schema: TaskSchema },
        ]),
        TokensModule,
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}
