import type { LoggerService } from '@nestjs/common';
import { createLogger, type Logger } from '@ctm/logger';

/**
 * Adapts the shared Pino logger to Nest's LoggerService so framework logs
 * (bootstrap, route mapping, exceptions) are emitted as JSON in production
 * instead of Nest's colourised console format.
 */
export class PinoLoggerService implements LoggerService {
    private readonly logger: Logger;

    constructor(name = 'main') {
        this.logger = createLogger(name);
    }

    /** Log at info level. */
    log(message: unknown, ...optional: unknown[]): void {
        this.logger.info(this.toPayload({ message, optional }));
    }

    /** Log at error level. Nest passes a stack string as the first optional param. */
    error(message: unknown, ...optional: unknown[]): void {
        this.logger.error(this.toPayload({ message, optional }));
    }

    /** Log at warn level. */
    warn(message: unknown, ...optional: unknown[]): void {
        this.logger.warn(this.toPayload({ message, optional }));
    }

    /** Log at debug level. */
    debug(message: unknown, ...optional: unknown[]): void {
        this.logger.debug(this.toPayload({ message, optional }));
    }

    /** Log at trace level. */
    verbose(message: unknown, ...optional: unknown[]): void {
        this.logger.trace(this.toPayload({ message, optional }));
    }

    // Nest's trailing args are untyped: the last is conventionally the context
    // string, and for error() an earlier one may be a stack trace.
    private toPayload({ message, optional }: { message: unknown; optional: unknown[] }): Record<string, unknown> {
        const strings = optional.filter((value): value is string => typeof value === 'string');
        const context = strings.at(-1);
        const stack = strings.length > 1 ? strings[0] : undefined;

        return {
            msg: typeof message === 'string' ? message : JSON.stringify(message),
            ...(context ? { context } : {}),
            ...(stack ? { stack } : {}),
        };
    }
}
