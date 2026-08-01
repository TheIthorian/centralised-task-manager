import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { getRequestContext } from '@ctm/logger';
import type { IncomingMessage, ServerResponse } from 'http';
import { runRequestWithLogging, type Logger } from './logging.js';
import { REQUEST_ID_HEADER } from './request-id.js';

describe('runRequestWithLogging', () => {
    it('echoes the inbound request id and exposes it to the handler', () => {
        const { logger, req, res } = fakeExchange({ [REQUEST_ID_HEADER]: 'trace-1' });
        let seen: string | undefined;

        runRequestWithLogging({
            logger,
            req,
            res,
            next: () => {
                seen = getRequestContext()?.requestId;
            },
        });

        expect(seen).toBe('trace-1');
        expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'trace-1');
    });

    it('mints a request id when the caller does not supply one', () => {
        const { logger, req, res } = fakeExchange({});
        let seen: string | undefined;

        runRequestWithLogging({
            logger,
            req,
            res,
            next: () => {
                seen = getRequestContext()?.requestId;
            },
        });

        expect(seen).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('leaves no context behind once the request is over', () => {
        const { logger, req, res } = fakeExchange({});

        runRequestWithLogging({ logger, req, res, next: () => undefined });

        expect(getRequestContext()).toBeUndefined();
    });

    it('puts the request id on the completed-request line', () => {
        const { logger, req, res, calls } = fakeExchange({ [REQUEST_ID_HEADER]: 'trace-2' });

        runRequestWithLogging({ logger, req, res, next: () => undefined });
        res.emit('finish');

        expect(calls.info[0]).toMatchObject({ requestId: 'trace-2', method: 'GET', url: '/tasks', status: 200 });
    });

    it('logs and rethrows a synchronous handler error', () => {
        const { logger, req, res, calls } = fakeExchange({});

        expect(() =>
            runRequestWithLogging({
                logger,
                req,
                res,
                next: () => {
                    throw new Error('boom');
                },
            }),
        ).toThrow('boom');

        expect(calls.error[0]).toMatchObject({ err: expect.any(Error), method: 'GET' });
    });
});

function fakeExchange(headers: Record<string, string>): {
    logger: Logger;
    req: IncomingMessage;
    res: ServerResponse & { setHeader: ReturnType<typeof vi.fn> };
    calls: Record<'info' | 'warn' | 'error', Record<string, unknown>[]>;
} {
    const calls: Record<'info' | 'warn' | 'error', Record<string, unknown>[]> = { info: [], warn: [], error: [] };
    const record =
        (level: 'info' | 'warn' | 'error') =>
        (payload: Record<string, unknown>): void => {
            calls[level].push(payload);
        };

    const logger = {
        info: vi.fn(record('info')),
        warn: vi.fn(record('warn')),
        error: vi.fn(record('error')),
    } as unknown as Logger;

    const req = { method: 'GET', url: '/tasks', headers } as unknown as IncomingMessage;
    const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: false,
        setHeader: vi.fn(),
    }) as unknown as ServerResponse & { setHeader: ReturnType<typeof vi.fn> };

    return { logger, req, res, calls };
}
