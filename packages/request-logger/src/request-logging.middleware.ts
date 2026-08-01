import { Injectable, NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'http';
import { createRequestLogger, runRequestWithLogging } from './logging.js';

/**
 * Nest + Fastify middleware that opens the correlation context for the request, then logs method,
 * URL, status, and duration once it finishes.
 * At the middie layer Nest passes raw Node `IncomingMessage` / `ServerResponse`, not Fastify wrappers.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger = createRequestLogger('http');

    /** Bind a request id, attach finish/error listeners, then delegate to the next handler. */
    use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
        runRequestWithLogging({ logger: this.logger, req, res, next });
    }
}
