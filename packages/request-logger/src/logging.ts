import type { IncomingMessage, ServerResponse } from 'http';
import {
    createLogger,
    getRequestContext,
    runWithRequestContext,
    type Logger,
    type RequestContext,
} from '@ctm/logger';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id.js';

export type { Logger };

/** Structured fields captured for each logged HTTP request. */
export type RequestLog = {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    requestId?: string;
    userId?: string;
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
    const context = getRequestContext();

    return {
        method: req.method ?? 'UNKNOWN',
        url: req.url ?? '/',
        status,
        durationMs,
        ...(context?.requestId ? { requestId: context.requestId } : {}),
        ...(context?.userId ? { userId: context.userId } : {}),
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
    if (req.method === 'OPTIONS') return; // skip noisy CORS preflight requests

    const log = buildRequestLog({ req, status, durationMs });
    const message = `${log.method} ${log.url} ${status ?? '-'}`;

    if (status !== undefined && status >= 400) {
        logger.warn(log, message);
    } else {
        logger.info(log, message);
    }
}

/**
 * Opens the correlation context for a request, echoes the id back on the response, and logs the
 * request once it finishes. Kept out of the middleware class so it can be exercised without the
 * Nest decorator, which the bare esbuild transform in this package cannot compile.
 */
export function runRequestWithLogging({
    logger,
    req,
    res,
    next,
}: {
    logger: Logger;
    req: IncomingMessage;
    res: ServerResponse;
    next: () => void;
}): void {
    const start = Date.now();
    const context: RequestContext = { requestId: resolveRequestId({ headerValue: req.headers[REQUEST_ID_HEADER] }) };

    if (!res.headersSent) res.setHeader(REQUEST_ID_HEADER, context.requestId);

    // 'finish' is emitted by the socket, outside the store the handler ran in, so the listener
    // re-enters the same context object rather than relying on it still being current. The object
    // is shared, so a userId bound during the request is on it by the time this runs.
    res.on('finish', () => {
        runWithRequestContext({
            context,
            fn: () => logRequest({ logger, req, status: res.statusCode, durationMs: Date.now() - start }),
        });
    });

    // The handler runs inside the store, so every downstream logger picks the id up from the
    // mixin without it being threaded through any signature.
    runWithRequestContext({
        context,
        fn: () => {
            try {
                next();
            } catch (error) {
                logRequestError({ logger, req, error: error instanceof Error ? error : new Error(String(error)) });

                throw error;
            }
        },
    });
}

/** Logs an unhandled error for a request. */
export function logRequestError({ logger, req, error }: { logger: Logger; req: IncomingMessage; error: Error }): void {
    logger.error(
        {
            ...buildRequestLog({ req }),
            err: error,
        },
        `Error handling ${req.method ?? 'UNKNOWN'} ${req.url ?? '/'}`,
    );
}
