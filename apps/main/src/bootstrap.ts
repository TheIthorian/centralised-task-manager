import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import { createLogger, installProcessErrorHandlers } from '@ctm/logger';
import { PinoLoggerService } from '@ctm/request-logger';
import { AppModule } from './app.module.js';

interface CorsOptions {
    origin: true | string[];
    credentials: boolean;
    methods: string[];
}

/** Build CORS options for the HTTP app from environment configuration. */
export function buildCorsOptions(env: NodeJS.ProcessEnv): CorsOptions {
    const corsOrigin = env['CORS_ORIGIN'] ?? '*';

    return {
        origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim()),
        credentials: corsOrigin !== '*',
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    };
}

/** Create and configure the Nest Fastify application. */
export async function createApp(): Promise<NestFastifyApplication> {
    installProcessErrorHandlers({ logger: createLogger('main') });

    // trustProxy: the service always runs behind a proxy in production, so without it every
    // request reports the proxy's address and IP-keyed rate limits bucket all clients together.
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true }), {
        logger: new PinoLoggerService(),
    });

    await app.register(compress, {
        global: true,
        threshold: 1024,
        encodings: ['br', 'gzip', 'deflate'],
    });

    await app.register(cookie);

    await app.register(multipart, { limits: { fileSize: 60 * 1024 * 1024 } });

    app.enableCors(buildCorsOptions(process.env));
    app.useWebSocketAdapter(new IoAdapter(app));

    return app;
}
