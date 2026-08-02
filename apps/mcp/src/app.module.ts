import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { APP_LOGGER, RequestLoggingMiddleware } from '@ctm/request-logger';
import { loadEnv } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { McpUnauthorizedFilter } from './auth/mcp-unauthorized.filter.js';
import { McpModule } from './mcp/mcp.module.js';
import { OAuthResourceModule } from './oauth/oauth-resource.module.js';

@Module({
    imports: [
        // `load` rather than `validationSchema`: loadEnv has already validated, and bootstrap
        // needed the result before Nest existed in order to build the logger. `ignoreEnvVars`
        // keeps raw process.env from shadowing the coerced and defaulted values.
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvVars: true, load: [loadEnv] }),
        OAuthResourceModule,
        HealthModule,
        AuthModule,
        McpModule,
    ],
    providers: [
        { provide: APP_FILTER, useClass: McpUnauthorizedFilter },
        { provide: APP_LOGGER, useFactory: rootLogger },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
