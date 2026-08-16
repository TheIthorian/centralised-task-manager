import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { APP_LOGGER, RequestLoggingMiddleware } from '@ctm/request-logger';
import { AppErrorFilter, HandlerValidationModule } from '@ctm/nest-common';
import { loadEnv } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';
import { DatabaseModule } from './database/database.module.js';
import { DatabaseConnectionInterceptor } from './database/database-connection.interceptor.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { ClientsModule } from './clients/clients.module.js';
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
        MetricsModule,
        ClientsModule,
        // Last, so it audits every controller the modules above registered.
        HandlerValidationModule,
    ],
    providers: [
        { provide: APP_FILTER, useClass: AppErrorFilter },
        { provide: APP_LOGGER, useFactory: rootLogger },
        // Global and without exception: nothing on an operator surface should be reachable
        // without an identity, so there is no route-level opt-out.
        { provide: APP_GUARD, useClass: AdminGuard },
        // After the guard, so an unauthenticated request cannot wake the database.
        { provide: APP_INTERCEPTOR, useClass: DatabaseConnectionInterceptor },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
