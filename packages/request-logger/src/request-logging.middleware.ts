import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Logger } from '@ctm/logger';
import type { IncomingMessage, ServerResponse } from 'http';
import { runRequestWithLogging } from './logging.js';
import { APP_LOGGER } from './logger.token.js';

/**
 * Nest + Fastify middleware that opens the correlation context for the request, then logs method,
 * URL, status, and duration once it finishes.
 * At the middie layer Nest passes raw Node `IncomingMessage` / `ServerResponse`, not Fastify wrappers.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    private readonly logger: Logger;

    constructor(@Inject(APP_LOGGER) logger: Logger) {
        this.logger = logger.child({ name: 'http' });
    }

    /** Bind a request id, attach finish/error listeners, then delegate to the next handler. */
    use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
        runRequestWithLogging({ logger: this.logger, req, res, next });
    }
}
