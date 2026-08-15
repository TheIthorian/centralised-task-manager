import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { installProcessErrorHandlers } from '@ctm/logger';
import { PinoLoggerService } from '@ctm/request-logger';
import { AppModule } from './app.module.js';
import { loadEnv, toLoggerConfig } from './config/load-env.js';
import { rootLogger } from './logging/app-logger.js';

/** Create and configure the Nest Fastify application. */
export async function createApp(): Promise<NestFastifyApplication> {
    // Validate before anything else: a bad environment should be one clear error, not a stack
    // trace from whichever subsystem happened to read it first. AppModule reuses this result.
    const env = loadEnv();

    installProcessErrorHandlers({ logger: rootLogger() });

    // trustProxy: the service runs behind a proxy, so without it every request reports the
    // proxy's address and the audit log records that instead of the operator's.
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true }), {
        logger: new PinoLoggerService({ name: 'admin', config: toLoggerConfig(env) }),
    });

    await app.register(cookie);

    // The session cookie is credentialed, so the allowed origin is the admin SPA alone. There is
    // no wildcard fallback: a misconfigured origin should fail closed.
    app.enableCors({
        origin: [String(env['ADMIN_WEB_URL'])],
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    return app;
}
