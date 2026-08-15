import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import type { Logger } from '@ctm/logger';
import { InternalError, NotFoundError, RateLimitError } from '@ctm/errors';
import { AppErrorFilter } from './app-error.filter.js';

describe('AppErrorFilter', () => {
    it('logs a 5xx at error with the error object attached', () => {
        const { filter, calls, host } = makeFilter();

        filter.catch(new InternalError('database is unreachable'), host);

        expect(calls.error).toHaveLength(1);
        expect(calls.warn).toHaveLength(0);
        expect(calls.error[0]?.[0]).toMatchObject({ err: expect.any(InternalError), statusCode: 500 });
    });

    it('logs a 4xx at warn', () => {
        const { filter, calls, host } = makeFilter();

        filter.catch(new NotFoundError('Task'), host);

        expect(calls.error).toHaveLength(0);
        expect(calls.warn[0]?.[0]).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('still sends the response body and the rate limit header', () => {
        const { filter, host, reply } = makeFilter();

        filter.catch(new RateLimitError({ message: 'slow down', retryAfterSeconds: 30 }), host);

        expect(reply.header).toHaveBeenCalledWith('Retry-After', '30');
        expect(reply.send).toHaveBeenCalledWith({
            statusCode: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'slow down',
        });
    });
});

type Calls = { error: unknown[][]; warn: unknown[][] };

function makeFilter(): {
    filter: AppErrorFilter;
    calls: Calls;
    host: ArgumentsHost;
    reply: { header: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
} {
    const calls: Calls = { error: [], warn: [] };

    const fakeLogger = {
        error: vi.fn((...args: unknown[]) => calls.error.push(args)),
        warn: vi.fn((...args: unknown[]) => calls.warn.push(args)),
        child: (): unknown => fakeLogger,
    } as unknown as Logger;

    const filter = new AppErrorFilter(fakeLogger);

    const send = vi.fn();
    const reply = { header: vi.fn(), status: vi.fn(() => ({ send })), send };
    const host = {
        switchToHttp: () => ({
            getResponse: () => reply,
            getRequest: () => ({ method: 'GET', url: '/tasks/1' }),
        }),
    } as unknown as ArgumentsHost;

    return { filter, calls, host, reply };
}
