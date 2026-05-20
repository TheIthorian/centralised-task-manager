import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

    const corsOrigin = process.env['CORS_ORIGIN'] ?? '*';
    app.enableCors({
        origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
        credentials: corsOrigin !== '*',
        // allowedHeaders intentionally omitted — @fastify/cors mirrors
        // Access-Control-Request-Headers from the preflight automatically
    });

    const port = process.env['PORT'] ?? 3000;
    await app.listen(port, '0.0.0.0');
}

void bootstrap();
