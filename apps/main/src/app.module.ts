import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_LOGGER, RequestLoggingMiddleware } from '@ctm/request-logger';
import { loadEnv } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';
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
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { AppErrorFilter } from './common/filters/app-error.filter.js';
import { HandlerValidationModule } from './common/validation/handler-validation.module.js';

@Module({
    imports: [
        // `load` rather than `validationSchema`: loadEnv has already validated, and bootstrap
        // needed the result before Nest existed in order to build the logger. `ignoreEnvVars`
        // keeps raw process.env from shadowing the coerced and defaulted values.
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvVars: true,
            load: [loadEnv],
        }),
        ScheduleModule.forRoot(),
        RateLimitModule,
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
        // Last, so it audits every controller the modules above registered.
        HandlerValidationModule,
    ],
    providers: [
        { provide: APP_FILTER, useClass: AppErrorFilter },
        { provide: APP_LOGGER, useFactory: rootLogger },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
