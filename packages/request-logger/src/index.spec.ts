import { describe, expect, it, vi } from 'vitest';
import { buildRequestLog, logRequest, logRequestError } from './logging.js';
import type { IncomingMessage } from 'http';
import type { Logger } from '@ctm/logger';

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
    return {
        method: 'POST',
        url: '/mcp',
        ...overrides,
    } as IncomingMessage;
}

function mockLogger(): Logger & { logs: { level: string; obj: object; msg: string }[] } {
    const logs: { level: string; obj: object; msg: string }[] = [];

    return {
        logs,
        info: vi.fn((obj: object, msg: string) => {
            logs.push({ level: 'info', obj, msg });
        }),
        warn: vi.fn((obj: object, msg: string) => {
            logs.push({ level: 'warn', obj, msg });
        }),
        error: vi.fn((obj: object, msg: string) => {
            logs.push({ level: 'error', obj, msg });
        }),
    } as Logger & { logs: { level: string; obj: object; msg: string }[] };
}

describe('buildRequestLog', () => {
    it('normalises missing method and url', () => {
        expect(buildRequestLog({ req: mockReq({ method: undefined, url: undefined }) })).toEqual({
            method: 'UNKNOWN',
            url: '/',
        });
    });

    it('includes status and duration when provided', () => {
        expect(
            buildRequestLog({
                req: mockReq(),
                status: 401,
                durationMs: 12,
            }),
        ).toEqual({
            method: 'POST',
            url: '/mcp',
            status: 401,
            durationMs: 12,
        });
    });
});

describe('logRequest', () => {
    it('logs 2xx at info', () => {
        const logger = mockLogger();

        logRequest({ logger, req: mockReq(), status: 200, durationMs: 5 });

        expect(logger.logs).toHaveLength(1);
        expect(logger.logs[0]?.level).toBe('info');
        expect(logger.logs[0]?.msg).toBe('POST /mcp 200');
    });

    it('logs 4xx at warn', () => {
        const logger = mockLogger();

        logRequest({ logger, req: mockReq(), status: 401, durationMs: 3 });

        expect(logger.logs[0]?.level).toBe('warn');
        expect(logger.logs[0]?.msg).toBe('POST /mcp 401');
    });
});

describe('logRequestError', () => {
    it('logs error with request context', () => {
        const logger = mockLogger();
        const error = new Error('boom');

        logRequestError({ logger, req: mockReq(), error });

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'POST', url: '/mcp', err: error }),
            'Error handling POST /mcp',
        );
    });
});
