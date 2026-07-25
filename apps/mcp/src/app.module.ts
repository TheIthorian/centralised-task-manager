import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RequestLoggingMiddleware } from '@ctm/request-logger';
import { envSchema } from './config/env.schema.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { McpUnauthorizedFilter } from './auth/mcp-unauthorized.filter.js';
import { McpModule } from './mcp/mcp.module.js';
import { OAuthResourceModule } from './oauth/oauth-resource.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
        OAuthResourceModule,
        HealthModule,
        AuthModule,
        McpModule,
    ],
    providers: [{ provide: APP_FILTER, useClass: McpUnauthorizedFilter }],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    }
}
