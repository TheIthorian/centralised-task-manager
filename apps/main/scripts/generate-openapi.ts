// Set BEFORE any import that evaluates AppModule: it tells the module to skip env
// validation, so the spec builds on a bare checkout with no environment at all.
process.env['OPENAPI_GENERATION'] = 'true';

import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module.js';
import { attachResponseSchemas } from './attach-response-schemas.js';

async function generate(): Promise<void> {
    // preview: true builds the module graph without instantiating providers, which is
    // all @nestjs/swagger needs. Nothing connects to MongoDB and no factory runs.
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: false,
        preview: true,
    });

    const config = new DocumentBuilder()
        .setTitle('Centralised Task Manager API')
        .setDescription('REST API for CTM — task aggregation, connector management, and OAuth 2.0.')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
        .build();

    const document = attachResponseSchemas({ document: SwaggerModule.createDocument(app, config) });

    writeFileSync('openapi.json', JSON.stringify(document, null, 2));
    console.info('openapi.json written');
    process.exit(0);
}

void generate();
