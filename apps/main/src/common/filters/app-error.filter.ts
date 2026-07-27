import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { AppError, RateLimitError } from '@ctm/errors';
import type { FastifyReply } from 'fastify';

/**
 * Translates typed `@ctm/errors` into HTTP responses. Without it every `AppError`
 * escapes as a generic 500, so services cannot signal 4xx conditions with a typed throw.
 */
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
    /** Send the error's own status code, message and machine-readable code. */
    catch(error: AppError, host: ArgumentsHost): void {
        const reply = host.switchToHttp().getResponse<FastifyReply>();

        if (error instanceof RateLimitError) {
            reply.header('Retry-After', String(error.retryAfterSeconds));
        }

        void reply.status(error.statusCode).send({
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
        });
    }
}
