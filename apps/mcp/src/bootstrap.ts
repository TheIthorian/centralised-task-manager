import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { installProcessErrorHandlers } from '@ctm/logger';
import { PinoLoggerService } from '@ctm/request-logger';
import { AppModule } from './app.module.js';
import { loadEnv, toLoggerConfig } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';

/** CORS for browser MCP clients (e.g. MCP Inspector). Allows any origin. */
export const mcpCorsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Mcp-Session-Id',
        'mcp-session-id',
        'Mcp-Protocol-Version',
        'mcp-protocol-version',
    ],
    exposedHeaders: [
        'Mcp-Session-Id',
        'mcp-session-id',
        'Mcp-Protocol-Version',
        'mcp-protocol-version',
        'WWW-Authenticate',
    ],
};

export async function createApp(): Promise<NestFastifyApplication> {
    // Validate before anything else: a bad environment should be one clear error, not a stack
    // trace from whichever subsystem happened to read it first. AppModule reuses this result.
    const env = loadEnv();

    installProcessErrorHandlers({ logger: rootLogger() });

    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: new PinoLoggerService({ name: 'mcp', config: toLoggerConfig(env) }),
    });

    app.enableCors(mcpCorsOptions);

    return app;
}
