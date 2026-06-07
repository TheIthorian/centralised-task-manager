// Set all required env vars BEFORE any imports that trigger NestJS/Mongoose initialization.
// Short serverSelectionTimeoutMS lets the MongoDB connection fail quickly so the script
// can generate the spec without a running database.
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/swagger?serverSelectionTimeoutMS=200&connectTimeoutMS=200';
process.env['ENCRYPTION_KEY'] = '0'.repeat(64);
process.env['RSA_PRIVATE_KEY'] = 'generate-only';
process.env['RSA_PUBLIC_KEY'] = 'generate-only';

import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module.js';

async function generate(): Promise<void> {
    // abortOnError: false — app creation succeeds even when MongoDB is unreachable.
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: false,
        abortOnError: false,
    });

    const config = new DocumentBuilder()
        .setTitle('Centralised Task Manager API')
        .setDescription('REST API for CTM — task aggregation, connector management, and OAuth 2.0.')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    writeFileSync('openapi.json', JSON.stringify(document, null, 2));
    console.info('openapi.json written');
    process.exit(0);
}

void generate();
