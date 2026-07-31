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

    /** Log at error level. Nest passes `(message, stack?, context?)`. */
    error(message: unknown, ...optional: unknown[]): void {
        this.logger.error(this.toPayload({ message, optional, hasStackArg: optional.length > 1 }));
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

    /** Log at fatal level. */
    fatal(message: unknown, ...optional: unknown[]): void {
        this.logger.fatal(this.toPayload({ message, optional, hasStackArg: optional.length > 1 }));
    }

    // Nest's trailing args are untyped and positional: the last is the context string, and for
    // error() and fatal() an extra leading arg is the stack. Reading them by arity rather than by
    // scanning for something stack-shaped means a single-argument call keeps its context instead
    // of having it silently reinterpreted as a stack.
    private toPayload({
        message,
        optional,
        hasStackArg = false,
    }: {
        message: unknown;
        optional: unknown[];
        hasStackArg?: boolean;
    }): Record<string, unknown> {
        const context = optional.at(-1);
        const stack = hasStackArg ? optional[0] : undefined;
        const err = message instanceof Error ? message : undefined;

        return {
            msg: err ? err.message : typeof message === 'string' ? message : JSON.stringify(message),
            ...(typeof context === 'string' ? { context } : {}),
            ...(err ? { err } : {}),
            ...(!err && typeof stack === 'string' ? { stack } : {}),
        };
    }
}
