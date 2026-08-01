import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { createLogger, installProcessErrorHandlers } from '@ctm/logger';
import { PinoLoggerService } from '@ctm/request-logger';
import { AppModule } from './app.module.js';

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
    installProcessErrorHandlers({ logger: createLogger('mcp') });

    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: new PinoLoggerService('mcp'),
    });

    app.enableCors(mcpCorsOptions);

    return app;
}
