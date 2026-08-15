import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { APP_LOGGER, RequestLoggingMiddleware } from '@ctm/request-logger';
import { AppErrorFilter, HandlerValidationModule } from '@ctm/nest-common';
import { loadEnv } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AdminGuard } from './auth/admin.guard.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvVars: true,
            load: [loadEnv],
        }),
        DatabaseModule,
        AuthModule,
        AuditModule,
        // Last, so it audits every controller the modules above registered.
        HandlerValidationModule,
    ],
    providers: [
        { provide: APP_FILTER, useClass: AppErrorFilter },
        { provide: APP_LOGGER, useFactory: rootLogger },
        // Global rather than per controller, so a new admin endpoint is closed by default and
        // opening one takes the deliberate act of marking it @Public().
        { provide: APP_GUARD, useClass: AdminGuard },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
