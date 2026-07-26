import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestLoggingMiddleware } from '@ctm/request-logger';
import { InternalError } from '@ctm/errors';
import { envSchema } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AppConfigModule } from './app-config/app-config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { OAuthModule } from './oauth/oauth.module.js';
import { SyncModule } from './sync/sync.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { DataPortabilityModule } from './data-portability/data-portability.module.js';

/**
 * The OpenAPI generator boots this module in Nest preview mode, where no provider is
 * instantiated and nothing reads configuration, so the spec can be produced without an
 * environment at all.
 */
const skipEnvValidation = process.env['OPENAPI_GENERATION'] === 'true';

if (skipEnvValidation && process.env['NODE_ENV'] === 'production') {
    throw new InternalError('OPENAPI_GENERATION must never be set on a running server');
}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            ...(skipEnvValidation ? {} : { validationSchema: envSchema }),
        }),
        ScheduleModule.forRoot(),
        DatabaseModule,
        HealthModule,
        AppConfigModule,
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
