import type { FastifyInstance } from 'fastify';
import type { Logger } from '@ctm/logger';

/** Largest payload written to the log. Anything longer is replaced by its size. */
export const MAX_LOGGED_PAYLOAD_BYTES = 4096;

/** Media types whose payload is readable in a log line. Anything else is described, not printed. */
const TEXTUAL_MEDIA_TYPES = [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/',
    '+json',
];

/**
 * Log the headers and payload of every request and response at debug level.
 *
 * Registered as Fastify hooks rather than middleware because the body is only parsed, and the
 * response payload only known, after the middleware layer has run. Does nothing unless the logger
 * is at debug, so a production deployment pays for none of it.
 */
export function registerPayloadLogging({ app, logger }: { app: FastifyInstance; logger: Logger }): void {
    if (!logger.isLevelEnabled('debug')) return;

    const payloadLogger = logger.child({ name: 'http' });

    app.addHook('preHandler', async (request) => {
        if (request.method === 'OPTIONS') return;

        payloadLogger.debug(
            {
                method: request.method,
                url: request.url,
                headers: request.headers,
                body: describePayload({ payload: request.body, contentType: request.headers['content-type'] }),
            },
            'inbound request',
        );
    });

    app.addHook('onSend', async (request, reply, payload: unknown) => {
        if (request.method === 'OPTIONS') return payload;

        payloadLogger.debug(
            {
                method: request.method,
                url: request.url,
                status: reply.statusCode,
                responseHeaders: reply.getHeaders(),
                responseBody: describePayload({
                    payload,
                    contentType: String(reply.getHeader('content-type') ?? ''),
                }),
            },
            'outbound response',
        );

        return payload;
    });
}

/**
 * Returns the payload in a form that is safe to log: objects pass through so pino's redaction can
 * reach their keys, text is truncated, and anything binary or oversized is reduced to a summary.
 */
function describePayload({ payload, contentType }: { payload: unknown; contentType?: string }): unknown {
    if (payload === undefined || payload === null) return undefined;

    if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        if (!isTextual(contentType)) return summarise({ contentType, length: undefined });

        const encoded = safeStringify(payload);

        return encoded !== undefined && encoded.length <= MAX_LOGGED_PAYLOAD_BYTES
            ? payload
            : summarise({ contentType, length: encoded?.length });
    }

    const text = Buffer.isBuffer(payload) ? undefined : typeof payload === 'string' ? payload : String(payload);
    const length = Buffer.isBuffer(payload) ? payload.byteLength : (text?.length ?? 0);

    if (!isTextual(contentType) || length > MAX_LOGGED_PAYLOAD_BYTES) return summarise({ contentType, length });

    return text;
}

function isTextual(contentType?: string): boolean {
    const value = (contentType ?? '').toLowerCase();

    return TEXTUAL_MEDIA_TYPES.some((type) => value.includes(type));
}

function summarise({ contentType, length }: { contentType?: string; length?: number }): string {
    return `${contentType || 'unknown content type'} of length ${length ?? -1}`;
}

function safeStringify(value: unknown): string | undefined {
    try {
        return JSON.stringify(value);
    } catch {
        return undefined;
    }
}
