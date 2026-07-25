import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
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
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(compress as any, {
        global: true,
        threshold: 1024,
        encodings: ['br', 'gzip', 'deflate'],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(cookie as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(multipart as any, { limits: { fileSize: 60 * 1024 * 1024 } });

    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.enableCors(buildCorsOptions(process.env));
    app.useWebSocketAdapter(new IoAdapter(app));

    return app;
}
