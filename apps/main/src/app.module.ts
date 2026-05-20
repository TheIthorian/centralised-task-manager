import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { envSchema } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
        ScheduleModule.forRoot(),
        DatabaseModule,
        AuthModule,
        ConnectorsModule,
        TasksModule,
    ],
})
export class AppModule {}
