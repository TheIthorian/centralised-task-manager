import type { IncomingMessage } from 'http';
import { createLogger, type Logger } from '@ctm/logger';

export type { Logger };

/** Structured fields captured for each logged HTTP request. */
export type RequestLog = {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
};

/** Creates a named logger for HTTP request logging. */
export function createRequestLogger(name: string): Logger {
    return createLogger(name);
}

/** Builds structured fields for a completed request. */
export function buildRequestLog({
    req,
    status,
    durationMs,
}: {
    req: IncomingMessage;
    status?: number;
    durationMs?: number;
}): RequestLog {
    return {
        method: req.method ?? 'UNKNOWN',
        url: req.url ?? '/',
        status,
        durationMs,
    };
}

/** Logs a completed HTTP request at info (2xx/3xx) or warn (4xx/5xx). */
export function logRequest({
    logger,
    req,
    status,
    durationMs,
}: {
    logger: Logger;
    req: IncomingMessage;
    status?: number;
    durationMs?: number;
}): void {
    const log = buildRequestLog({ req, status, durationMs });
    const message = `${log.method} ${log.url} ${status ?? '-'}`;

    if (status !== undefined && status >= 400) {
        logger.warn(log, message);
    } else {
        logger.info(log, message);
    }
}

/** Logs an unhandled error for a request. */
export function logRequestError({
    logger,
    req,
    error,
}: {
    logger: Logger;
    req: IncomingMessage;
    error: Error;
}): void {
    logger.error(
        {
            method: req.method,
            url: req.url,
            err: error,
        },
        `Error handling ${req.method ?? 'UNKNOWN'} ${req.url ?? '/'}`,
    );
}
