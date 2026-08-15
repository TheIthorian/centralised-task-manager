import { ArgumentsHost, Catch, Inject, type ExceptionFilter } from '@nestjs/common';
import { AppError, RateLimitError } from '@ctm/errors';
import { APP_LOGGER } from '@ctm/request-logger';
import type { Logger } from '@ctm/logger';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Translates typed `@ctm/errors` into HTTP responses. Without it every `AppError`
 * escapes as a generic 500, so services cannot signal 4xx conditions with a typed throw.
 */
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
    private readonly logger: Logger;

    // The root logger is built from the environment of whichever app installs this filter, so it
    // arrives through the container rather than being imported from one of them.
    constructor(@Inject(APP_LOGGER) logger: Logger) {
        this.logger = logger.child({ name: 'app-error' });
    }

    /** Log the failure, then send the error's own status code, message and machine-readable code. */
    catch(error: AppError, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const reply = http.getResponse<FastifyReply>();
        const request = http.getRequest<FastifyRequest>();

        this.logError({ error, request });

        if (error instanceof RateLimitError) {
            reply.header('Retry-After', String(error.retryAfterSeconds));
        }

        void reply.status(error.statusCode).send({
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
        });
    }

    // 5xx is ours to fix and needs the stack. Everything else is the caller's input being
    // rejected as designed, which is worth a line but never a page.
    private logError({ error, request }: { error: AppError; request?: FastifyRequest }): void {
        const payload = { err: error, code: error.code, statusCode: error.statusCode, req: request };
        const message = `${error.code} on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? '/'}`;

        if (error.statusCode >= 500) {
            this.logger.error(payload, message);

            return;
        }

        this.logger.warn(payload, message);
    }
}
