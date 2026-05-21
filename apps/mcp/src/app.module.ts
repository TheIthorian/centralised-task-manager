import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.schema.js';
import { AuthModule } from './auth/auth.module.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
        AuthModule,
        McpModule,
    ],
})
export class AppModule {}
