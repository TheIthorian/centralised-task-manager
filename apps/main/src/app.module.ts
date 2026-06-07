import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestLoggingMiddleware } from '@ctm/request-logger';
import { envSchema } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { OAuthModule } from './oauth/oauth.module.js';
import { SyncModule } from './sync/sync.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { DataPortabilityModule } from './data-portability/data-portability.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
        ScheduleModule.forRoot(),
        DatabaseModule,
        AuthModule,
        ConnectorsModule,
        TasksModule,
        RemindersModule,
        OAuthModule,
        SyncModule,
        NotificationsModule,
        DataPortabilityModule,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
