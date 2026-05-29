import { Injectable, NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'http';
import { createRequestLogger, logRequest, logRequestError } from './logging.js';

/**
 * Nest + Fastify middleware that logs method, URL, status, and duration for every request.
 * At the middie layer Nest passes raw Node `IncomingMessage` / `ServerResponse`, not Fastify wrappers.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger = createRequestLogger('http');

    /** Attach finish/error listeners then delegate to the next handler. */
    use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
        const start = Date.now();

        res.on('finish', () => {
            logRequest({ logger: this.logger, req, status: res.statusCode, durationMs: Date.now() - start });
        });

        try {
            next();
        } catch (error) {
            logRequestError({
                logger: this.logger,
                req,
                error: error instanceof Error ? error : new Error(String(error)),
            });

            throw error;
        }
    }
}
