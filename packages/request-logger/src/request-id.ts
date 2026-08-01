import { randomUUID } from 'crypto';

/** Header carrying the correlation id in and out of the service. */
export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[\w.:-]+$/;

/**
 * Reuses an inbound correlation id so a trace survives a hop between services, but only when it
 * is short and free of control characters: the value is echoed into a response header and into
 * every log line, so an unbounded one is a header-injection and log-forging vector.
 */
export function resolveRequestId({ headerValue }: { headerValue: string | string[] | undefined }): string {
    const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (candidate && candidate.length <= MAX_REQUEST_ID_LENGTH && SAFE_REQUEST_ID.test(candidate)) return candidate;

    return randomUUID();
}
